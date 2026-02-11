"""
Configuration for WebhookTrader.
In production, use environment variables or a .env file.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """
    All config is loaded from environment variables.
    Create a .env file in the project root to override defaults:

    PAPER_TRADING=true
    EXCHANGE=binance
    API_KEY=your_api_key_here
    API_SECRET=your_api_secret_here
    """

    # ── Trading Mode ──
    PAPER_TRADING: bool = True  # True = simulated orders, False = real orders

    # ── Exchange Config ──
    EXCHANGE: str = "binance"  # binance, bybit, okx
    API_KEY: Optional[str] = None
    API_SECRET: Optional[str] = None
    API_PASSPHRASE: Optional[str] = None  # Required for OKX

    # ── Default Quantities (when TradingView doesn't send qty) ──
    DEFAULT_QTY: dict = {
        "BTC/USDT": 0.001,
        "ETH/USDT": 0.01,
        "SOL/USDT": 0.1,
    }

    # ── Server ──
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Security ──
    WEBHOOK_SECRET: Optional[str] = None  # Optional: verify TradingView requests

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
