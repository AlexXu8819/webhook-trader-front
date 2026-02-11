"""
Test script — Simulate TradingView webhook calls.
Run this while the server is running to test the pipeline.

Usage: python test_webhook.py
"""

import requests
import json
import time

SERVER_URL = "http://localhost:8000"


def test_health():
    """Test health endpoint."""
    print("=" * 50)
    print("TEST: Health Check")
    print("=" * 50)
    r = requests.get(f"{SERVER_URL}/api/health")
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_buy_btc():
    """Simulate a BTC buy signal from TradingView."""
    print("=" * 50)
    print("TEST: BUY BTC/USDT")
    print("=" * 50)
    payload = {
        "strategy": "EMA Crossover",
        "action": "buy",
        "ticker": "BINANCE:BTCUSDT",
        "price": 97500.0,
        "qty": 0.01,
        "timestamp": "2026-02-09T12:00:00Z",
    }
    r = requests.post(f"{SERVER_URL}/api/webhook/tv", json=payload)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_sell_eth():
    """Simulate an ETH sell signal."""
    print("=" * 50)
    print("TEST: SELL ETH/USDT")
    print("=" * 50)
    payload = {
        "strategy": "RSI Divergence",
        "action": "sell",
        "ticker": "ETHUSDT",
        "price": 3850.0,
        "qty": 0.5,
        "timestamp": "2026-02-09T12:05:00Z",
    }
    r = requests.post(f"{SERVER_URL}/api/webhook/tv", json=payload)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_buy_sol():
    """Simulate a SOL buy signal."""
    print("=" * 50)
    print("TEST: BUY SOL/USDT")
    print("=" * 50)
    payload = {
        "strategy": "MACD Signal",
        "action": "buy",
        "ticker": "SOLUSDT.P",
        "price": 188.50,
        "qty": 2.0,
    }
    r = requests.post(f"{SERVER_URL}/api/webhook/tv", json=payload)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_invalid_action():
    """Test with invalid action (should return 400)."""
    print("=" * 50)
    print("TEST: Invalid Action (expect 400)")
    print("=" * 50)
    payload = {
        "strategy": "Test",
        "action": "hodl",
        "ticker": "BTCUSDT",
        "price": 97000.0,
        "qty": 0.01,
    }
    r = requests.post(f"{SERVER_URL}/api/webhook/tv", json=payload)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_raw_webhook():
    """Test raw webhook endpoint with arbitrary data."""
    print("=" * 50)
    print("TEST: Raw Webhook (debug endpoint)")
    print("=" * 50)
    payload = {"custom_field": "hello", "any_data": 123}
    r = requests.post(f"{SERVER_URL}/api/webhook/raw", json=payload)
    print(f"Status: {r.status_code}")
    print(json.dumps(r.json(), indent=2))
    print()


def test_get_signals():
    """Fetch all recorded signals."""
    print("=" * 50)
    print("TEST: Get Signal History")
    print("=" * 50)
    r = requests.get(f"{SERVER_URL}/api/signals")
    data = r.json()
    print(f"Total signals: {data['total']}")
    for s in data["signals"]:
        print(f"  #{s['id']} [{s['status']}] {s.get('action', 'raw')} {s.get('ticker', 'N/A')}")
    print()


if __name__ == "__main__":
    print("\n🚀 WebhookTrader Test Suite\n")

    test_health()
    time.sleep(0.3)

    test_buy_btc()
    time.sleep(0.3)

    test_sell_eth()
    time.sleep(0.3)

    test_buy_sol()
    time.sleep(0.3)

    test_invalid_action()
    time.sleep(0.3)

    test_raw_webhook()
    time.sleep(0.3)

    test_get_signals()

    print("✅ All tests completed!")
