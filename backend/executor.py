"""
Trade Executor
==============
Handles order execution. Supports:
  - Paper trading (simulated, no real money)
  - Live trading via ccxt (Binance, Bybit, OKX, etc.)
"""

import logging
import random
from datetime import datetime
from typing import Optional

from config import settings

logger = logging.getLogger("webhook-trader")


class TradeExecutor:
    """
    Executes trades based on webhook signals.
    Defaults to paper trading mode for safety.
    """

    def __init__(self):
        self._exchange = None
        self._paper_balance: dict = {
            "USDT": 10000.0,   # Starting paper balance
            "BTC": 0.0,
            "ETH": 0.0,
            "SOL": 0.0,
        }
        self._paper_trades: list = []

        if not settings.PAPER_TRADING:
            self._init_live_exchange()

    def _init_live_exchange(self):
        """Initialize live exchange connection via ccxt."""
        try:
            import ccxt

            exchange_class = getattr(ccxt, settings.EXCHANGE, None)
            if exchange_class is None:
                logger.error(f"Exchange '{settings.EXCHANGE}' not supported by ccxt")
                return

            config = {
                "apiKey": settings.API_KEY,
                "secret": settings.API_SECRET,
                "enableRateLimit": True,
            }

            if settings.API_PASSPHRASE:
                config["password"] = settings.API_PASSPHRASE

            self._exchange = exchange_class(config)
            logger.info(f"Connected to {settings.EXCHANGE} (LIVE MODE)")

        except ImportError:
            logger.error("ccxt not installed. Run: pip install ccxt")
        except Exception as e:
            logger.error(f"Failed to connect to exchange: {e}")

    def is_connected(self) -> bool:
        """Check if exchange connection is alive."""
        if settings.PAPER_TRADING:
            return True
        return self._exchange is not None

    async def execute(
        self,
        action: str,
        ticker: str,
        qty: float,
        price: float,
    ) -> dict:
        """
        Execute a trade order.

        Args:
            action: "buy" or "sell"
            ticker: Trading pair, e.g. "BTC/USDT"
            qty: Order quantity
            price: Reference price from TradingView

        Returns:
            Order result dict
        """
        if settings.PAPER_TRADING:
            return await self._paper_trade(action, ticker, qty, price)
        else:
            return await self._live_trade(action, ticker, qty, price)

    async def _paper_trade(
        self, action: str, ticker: str, qty: float, price: float
    ) -> dict:
        """Simulate a trade without real money."""
        base, quote = ticker.split("/")  # e.g. "BTC", "USDT"
        cost = qty * price

        # Simple balance check
        if action == "buy":
            if self._paper_balance.get(quote, 0) < cost:
                raise Exception(
                    f"Insufficient {quote} balance. "
                    f"Need {cost:.2f}, have {self._paper_balance.get(quote, 0):.2f}"
                )
            self._paper_balance[quote] -= cost
            self._paper_balance[base] = self._paper_balance.get(base, 0) + qty

        elif action == "sell":
            if self._paper_balance.get(base, 0) < qty:
                raise Exception(
                    f"Insufficient {base} balance. "
                    f"Need {qty}, have {self._paper_balance.get(base, 0)}"
                )
            self._paper_balance[base] -= qty
            self._paper_balance[quote] = self._paper_balance.get(quote, 0) + cost

        # Simulate a small slippage
        slippage = random.uniform(-0.001, 0.001)
        fill_price = price * (1 + slippage)

        order = {
            "order_id": f"paper_{len(self._paper_trades) + 1}",
            "mode": "paper",
            "action": action,
            "ticker": ticker,
            "qty": qty,
            "requested_price": price,
            "fill_price": round(fill_price, 2),
            "slippage_pct": round(slippage * 100, 4),
            "cost": round(qty * fill_price, 2),
            "balance_after": {k: round(v, 6) for k, v in self._paper_balance.items()},
            "filled_at": datetime.now().isoformat(),
        }

        self._paper_trades.append(order)
        logger.info(
            f"[PAPER] {action.upper()} {qty} {ticker} @ ${fill_price:.2f} "
            f"(slippage: {slippage*100:.3f}%)"
        )

        return order

    async def _live_trade(
        self, action: str, ticker: str, qty: float, price: float
    ) -> dict:
        """Execute a real trade on the exchange."""
        if not self._exchange:
            raise Exception("Exchange not connected")

        try:
            if action == "buy":
                order = self._exchange.create_market_buy_order(ticker, qty)
            else:
                order = self._exchange.create_market_sell_order(ticker, qty)

            logger.info(f"[LIVE] Order placed: {order.get('id')}")
            return {
                "order_id": order.get("id"),
                "mode": "live",
                "action": action,
                "ticker": ticker,
                "qty": qty,
                "status": order.get("status"),
                "fill_price": order.get("average") or order.get("price"),
                "raw_response": order,
                "filled_at": datetime.now().isoformat(),
            }

        except Exception as e:
            logger.error(f"[LIVE] Order failed: {e}")
            raise

    def get_paper_balance(self) -> dict:
        """Get current paper trading balance."""
        return {k: round(v, 6) for k, v in self._paper_balance.items()}

    def get_paper_trades(self) -> list:
        """Get paper trade history."""
        return self._paper_trades
