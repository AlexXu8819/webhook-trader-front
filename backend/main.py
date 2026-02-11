"""
WebhookTrader - TradingView Webhook Auto-Trading Server
========================================================
A FastAPI server that receives TradingView webhook alerts
and executes trades on cryptocurrency exchanges.

Run with: uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import json
import logging

from config import settings
from executor import TradeExecutor

# ─── Logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("webhook-trader")

# ─── App ───────────────────────────────────────────────────
app = FastAPI(
    title="WebhookTrader",
    description="TradingView Webhook → Auto Trading",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory storage (replace with DB later) ────────────
signal_history: list[dict] = []
executor = TradeExecutor()


# ─── Models ────────────────────────────────────────────────
class WebhookPayload(BaseModel):
    """
    Matches the TradingView alert message template:
    {
      "strategy": "{{strategy.order.alert_message}}",
      "action": "{{strategy.order.action}}",
      "ticker": "{{ticker}}",
      "price": {{close}},
      "qty": {{strategy.order.contracts}},
      "timestamp": "{{timenow}}"
    }
    """
    strategy: str = Field(..., description="Strategy name from TradingView")
    action: str = Field(..., description="buy or sell")
    ticker: str = Field(..., description="Trading pair, e.g. BTCUSDT")
    price: float = Field(..., description="Current price at alert time")
    qty: float = Field(default=0, description="Order quantity")
    timestamp: Optional[str] = Field(default=None, description="TradingView timestamp")


class SignalResponse(BaseModel):
    status: str
    message: str
    signal_id: int
    order_result: Optional[dict] = None


# ─── Routes ────────────────────────────────────────────────

@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "WebhookTrader",
        "status": "running",
        "version": "0.1.0",
        "time": datetime.now().isoformat(),
    }


@app.get("/api/health")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "exchange_connected": executor.is_connected(),
        "signals_processed": len(signal_history),
        "uptime": datetime.now().isoformat(),
    }


@app.post("/api/webhook/tv", response_model=SignalResponse)
async def receive_tradingview_webhook(payload: WebhookPayload, request: Request):
    """
    Main webhook endpoint.
    TradingView sends POST requests here when alerts trigger.
    """
    client_ip = request.client.host
    logger.info(f"Webhook received from {client_ip}: {payload.model_dump_json()}")

    # ── 1. Validate the signal ──
    action = payload.action.lower().strip()
    if action not in ("buy", "sell"):
        logger.warning(f"Invalid action: {payload.action}")
        raise HTTPException(status_code=400, detail=f"Invalid action: {payload.action}. Must be 'buy' or 'sell'.")

    # ── 2. Normalize ticker ──
    # TradingView sends "BTCUSDT" or "BINANCE:BTCUSDT", we need "BTC/USDT"
    ticker = normalize_ticker(payload.ticker)

    # ── 3. Determine quantity ──
    qty = payload.qty if payload.qty > 0 else settings.DEFAULT_QTY.get(ticker, 0.001)

    # ── 4. Build signal record ──
    signal = {
        "id": len(signal_history) + 1,
        "strategy": payload.strategy,
        "action": action,
        "ticker": ticker,
        "price": payload.price,
        "qty": qty,
        "raw_payload": payload.model_dump(),
        "received_at": datetime.now().isoformat(),
        "client_ip": client_ip,
        "status": "pending",
        "order_result": None,
    }

    # ── 5. Execute trade ──
    try:
        order_result = await executor.execute(
            action=action,
            ticker=ticker,
            qty=qty,
            price=payload.price,
        )
        signal["status"] = "filled"
        signal["order_result"] = order_result
        logger.info(f"Order executed: {action.upper()} {qty} {ticker} @ ${payload.price}")
    except Exception as e:
        signal["status"] = "failed"
        signal["error"] = str(e)
        logger.error(f"Order failed: {e}")

    # ── 6. Save to history ──
    signal_history.append(signal)

    return SignalResponse(
        status=signal["status"],
        message=f"{action.upper()} {qty} {ticker} @ ${payload.price}",
        signal_id=signal["id"],
        order_result=signal.get("order_result"),
    )


@app.post("/api/webhook/raw")
async def receive_raw_webhook(request: Request):
    """
    Fallback endpoint that accepts any JSON body.
    Useful for debugging what TradingView actually sends.
    """
    try:
        body = await request.json()
    except Exception:
        body = (await request.body()).decode()

    logger.info(f"Raw webhook received: {json.dumps(body, indent=2)}")

    signal_history.append({
        "id": len(signal_history) + 1,
        "raw": body,
        "received_at": datetime.now().isoformat(),
        "client_ip": request.client.host,
        "status": "raw_logged",
    })

    return {"status": "received", "body": body}


@app.get("/api/signals")
async def get_signals(limit: int = 50):
    """Get recent signal history."""
    return {
        "total": len(signal_history),
        "signals": signal_history[-limit:][::-1],  # newest first
    }


@app.delete("/api/signals")
async def clear_signals():
    """Clear signal history (dev only)."""
    signal_history.clear()
    return {"status": "cleared"}


# ─── Helpers ───────────────────────────────────────────────

def normalize_ticker(raw: str) -> str:
    """
    Convert TradingView ticker formats to standard pair format.
    Examples:
      "BTCUSDT"           → "BTC/USDT"
      "BINANCE:BTCUSDT"   → "BTC/USDT"
      "ETHUSDT.P"         → "ETH/USDT"
      "BTC/USDT"          → "BTC/USDT" (already correct)
    """
    # Remove exchange prefix
    if ":" in raw:
        raw = raw.split(":")[-1]

    # Remove perpetual suffix
    raw = raw.replace(".P", "").replace(".p", "")

    # If already has slash, return as-is
    if "/" in raw:
        return raw.upper()

    # Try to split common quote currencies
    for quote in ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH"]:
        if raw.upper().endswith(quote):
            base = raw.upper()[: -len(quote)]
            return f"{base}/{quote}"

    return raw.upper()


# ─── Startup ───────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    logger.info("=" * 50)
    logger.info("WebhookTrader server starting...")
    logger.info(f"Mode: {'PAPER TRADING' if settings.PAPER_TRADING else 'LIVE TRADING'}")
    logger.info(f"Exchange: {settings.EXCHANGE}")
    logger.info("Webhook endpoint: POST /api/webhook/tv")
    logger.info("=" * 50)
