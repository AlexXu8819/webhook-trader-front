import { useState, useEffect, useRef, useCallback } from "react";

const MOCK_STRATEGIES = [
  { id: "s1", name: "EMA Crossover", pair: "BTC/USDT", exchange: "Binance", status: "active", pnl: 12.5 },
  { id: "s2", name: "RSI Divergence", pair: "ETH/USDT", exchange: "Bybit", status: "active", pnl: -3.2 },
  { id: "s3", name: "MACD Signal", pair: "SOL/USDT", exchange: "OKX", status: "paused", pnl: 8.7 },
];

const MOCK_SIGNALS = [
  { id: 1, time: "14:32:05", strategy: "EMA Crossover", pair: "BTC/USDT", action: "BUY", price: 97432.5, qty: 0.015, status: "filled" },
  { id: 2, time: "14:28:11", strategy: "RSI Divergence", pair: "ETH/USDT", action: "SELL", price: 3842.1, qty: 0.85, status: "filled" },
  { id: 3, time: "14:15:33", strategy: "EMA Crossover", pair: "BTC/USDT", action: "SELL", price: 97105.0, qty: 0.015, status: "filled" },
  { id: 4, time: "13:55:20", strategy: "MACD Signal", pair: "SOL/USDT", action: "BUY", price: 186.32, qty: 2.5, status: "rejected" },
];

// Utility
const cn = (...classes) => classes.filter(Boolean).join(" ");
const fmt = (n, d = 2) => Number(n).toFixed(d);

// ─── Icons ────────────────────────────────────────────────
const Icon = ({ d, size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IconActivity = (p) => <Icon {...p} d="M22 12h-4l-3 9L9 3l-3 9H2" />;
const IconZap = (p) => <Icon {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const IconPause = (p) => <Icon {...p} d="M6 4h4v16H6zM14 4h4v16h-4z" />;
const IconPlay = (p) => <Icon {...p} d="M5 3l14 9-14 9V3z" />;
const IconSend = (p) => <Icon {...p} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />;
const IconCopy = (p) => <Icon {...p} d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />;
const IconCheck = (p) => <Icon {...p} d="M20 6L9 17l-5-5" />;
const IconSettings = (p) => <Icon {...p} d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />;

// ─── Webhook Payload Template ──────────────────────────────
const WEBHOOK_TEMPLATE = `{
  "strategy": "{{strategy.order.alert_message}}",
  "action": "{{strategy.order.action}}",
  "ticker": "{{ticker}}",
  "price": {{close}},
  "qty": {{strategy.order.contracts}},
  "timestamp": "{{timenow}}"
}`;

// ─── Styles ───────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  :root {
    --bg-base: #0a0b0f;
    --bg-card: #12131a;
    --bg-elevated: #1a1b25;
    --bg-hover: #222333;
    --border: #2a2b3d;
    --border-accent: #3d3e5c;
    --text-primary: #e8e9f0;
    --text-secondary: #8b8ca7;
    --text-muted: #5a5b75;
    --accent-green: #00e396;
    --accent-green-dim: #00e39620;
    --accent-red: #ff4560;
    --accent-red-dim: #ff456020;
    --accent-blue: #5a8fff;
    --accent-blue-dim: #5a8fff20;
    --accent-amber: #ffb547;
    --accent-amber-dim: #ffb54720;
    --accent-purple: #9b6dff;
    --radius: 10px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: 'Plus Jakarta Sans', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 80% 60% at 50% -20%, #5a8fff08, transparent),
      radial-gradient(ellipse 60% 40% at 80% 100%, #9b6dff06, transparent),
      var(--bg-base);
  }

  /* Header */
  .header {
    padding: 20px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 100;
    background: var(--bg-base)ee;
  }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .logo {
    width: 36px; height: 36px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; color: #fff;
    letter-spacing: -0.5px;
    box-shadow: 0 0 20px #5a8fff30;
  }
  .header h1 {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .header h1 span { color: var(--text-muted); font-weight: 500; }
  .header-right { display: flex; align-items: center; gap: 12px; }
  .status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent-green);
    box-shadow: 0 0 8px var(--accent-green);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .status-label {
    font-size: 13px;
    color: var(--accent-green);
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.5px;
  }

  /* Layout */
  .layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 0;
    min-height: calc(100vh - 77px);
  }
  .main { padding: 24px 28px; display: flex; flex-direction: column; gap: 24px; }
  .sidebar {
    border-left: 1px solid var(--border);
    display: flex; flex-direction: column;
  }

  /* Cards */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .card-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  .card-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text-secondary);
  }
  .card-badge {
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 600;
  }

  /* Stats Row */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .stat-card:hover { border-color: var(--border-accent); }
  .stat-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
  }
  .stat-card.green::before { background: var(--accent-green); }
  .stat-card.blue::before { background: var(--accent-blue); }
  .stat-card.amber::before { background: var(--accent-amber); }
  .stat-card.purple::before { background: var(--accent-purple); }
  .stat-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .stat-value {
    font-size: 26px;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: -1px;
  }
  .stat-sub {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Strategy List */
  .strategy-row {
    display: flex;
    align-items: center;
    padding: 14px 20px;
    gap: 14px;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
    cursor: pointer;
  }
  .strategy-row:hover { background: var(--bg-hover); }
  .strategy-row:last-child { border-bottom: none; }
  .strategy-icon {
    width: 36px; height: 36px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .strategy-info { flex: 1; min-width: 0; }
  .strategy-name {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .strategy-meta {
    font-size: 12px;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }
  .strategy-pnl {
    font-size: 14px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }
  .strategy-toggle {
    width: 32px; height: 32px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .strategy-toggle:hover {
    border-color: var(--accent-blue);
    color: var(--accent-blue);
    background: var(--accent-blue-dim);
  }

  /* Signal Table */
  .signal-table { width: 100%; }
  .signal-table th {
    padding: 10px 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    text-align: left;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border);
  }
  .signal-table td {
    padding: 12px 20px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    border-bottom: 1px solid var(--border);
  }
  .signal-table tr:last-child td { border-bottom: none; }
  .signal-table tr {
    transition: background 0.15s;
  }
  .signal-table tbody tr:hover { background: var(--bg-hover); }

  .tag {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .tag-buy { background: var(--accent-green-dim); color: var(--accent-green); }
  .tag-sell { background: var(--accent-red-dim); color: var(--accent-red); }
  .tag-filled { background: var(--accent-blue-dim); color: var(--accent-blue); }
  .tag-rejected { background: var(--accent-amber-dim); color: var(--accent-amber); }

  /* Sidebar Sections */
  .sidebar-section {
    padding: 20px;
    border-bottom: 1px solid var(--border);
  }
  .sidebar-section:last-child { border-bottom: none; flex: 1; }
  .sidebar-title {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Webhook URL */
  .webhook-url-box {
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .webhook-url {
    flex: 1;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: var(--accent-blue);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .copy-btn {
    width: 30px; height: 30px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .copy-btn:hover {
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }

  /* Code Block */
  .code-block {
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.7;
    color: var(--text-secondary);
    overflow-x: auto;
    white-space: pre;
  }

  /* Simulate Panel */
  .sim-form { display: flex; flex-direction: column; gap: 12px; }
  .sim-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sim-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .sim-field select,
  .sim-field input {
    width: 100%;
    background: var(--bg-base);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 9px 12px;
    color: var(--text-primary);
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    transition: border-color 0.15s;
  }
  .sim-field select:focus,
  .sim-field input:focus { border-color: var(--accent-blue); }
  .sim-field select { cursor: pointer; appearance: none; }

  .btn-simulate {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    font-family: 'Plus Jakarta Sans', sans-serif;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    letter-spacing: 0.3px;
  }
  .btn-simulate:hover { opacity: 0.9; }
  .btn-simulate:active { transform: scale(0.98); }

  /* Live Log */
  .log-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .log-entries {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    max-height: 300px;
  }
  .log-entry {
    padding: 8px 20px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    line-height: 1.6;
    border-left: 2px solid transparent;
    animation: log-in 0.3s ease-out;
  }
  @keyframes log-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .log-entry.info { border-left-color: var(--accent-blue); color: var(--text-secondary); }
  .log-entry.success { border-left-color: var(--accent-green); color: var(--accent-green); }
  .log-entry.warn { border-left-color: var(--accent-amber); color: var(--accent-amber); }
  .log-entry.error { border-left-color: var(--accent-red); color: var(--accent-red); }
  .log-time { color: var(--text-muted); margin-right: 8px; }

  /* Tab system */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
    background: var(--bg-card);
  }
  .tab {
    padding: 12px 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .tab:hover { color: var(--text-secondary); }
  .tab.active {
    color: var(--accent-blue);
    border-bottom-color: var(--accent-blue);
  }

  /* Flow diagram */
  .flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 20px 0;
  }
  .flow-node {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    text-align: center;
    white-space: nowrap;
  }
  .flow-arrow {
    color: var(--text-muted);
    font-size: 18px;
    padding: 0 8px;
    flex-shrink: 0;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-accent); }

  /* Responsive */
  @media (max-width: 1100px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { border-left: none; border-top: 1px solid var(--border); }
    .stats-row { grid-template-columns: repeat(2, 1fr); }
  }
`;

// ─── Components ───────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={cn("stat-card", accent)}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function StrategyRow({ strategy, onToggle }) {
  const isActive = strategy.status === "active";
  const pnlColor = strategy.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)";
  const bgColor = isActive ? "var(--accent-green-dim)" : "var(--accent-amber-dim)";
  const iconColor = isActive ? "var(--accent-green)" : "var(--accent-amber)";

  return (
    <div className="strategy-row">
      <div className="strategy-icon" style={{ background: bgColor }}>
        <IconActivity size={16} color={iconColor} />
      </div>
      <div className="strategy-info">
        <div className="strategy-name">{strategy.name}</div>
        <div className="strategy-meta">{strategy.pair} · {strategy.exchange}</div>
      </div>
      <div className="strategy-pnl" style={{ color: pnlColor }}>
        {strategy.pnl >= 0 ? "+" : ""}{fmt(strategy.pnl)}%
      </div>
      <button className="strategy-toggle" onClick={() => onToggle(strategy.id)} title={isActive ? "Pause" : "Resume"}>
        {isActive ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
    </div>
  );
}

function SignalTable({ signals }) {
  return (
    <table className="signal-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Strategy</th>
          <th>Pair</th>
          <th>Action</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {signals.map((s) => (
          <tr key={s.id}>
            <td style={{ color: "var(--text-muted)" }}>{s.time}</td>
            <td style={{ color: "var(--text-primary)" }}>{s.strategy}</td>
            <td>{s.pair}</td>
            <td><span className={cn("tag", s.action === "BUY" ? "tag-buy" : "tag-sell")}>{s.action}</span></td>
            <td>${s.price.toLocaleString()}</td>
            <td>{s.qty}</td>
            <td><span className={cn("tag", s.status === "filled" ? "tag-filled" : "tag-rejected")}>{s.status.toUpperCase()}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LogEntry({ entry }) {
  return (
    <div className={cn("log-entry", entry.type)}>
      <span className="log-time">{entry.time}</span>
      {entry.msg}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────

export default function TradingWebhookDemo() {
  const [strategies, setStrategies] = useState(MOCK_STRATEGIES);
  const [signals, setSignals] = useState(MOCK_SIGNALS);
  const [logs, setLogs] = useState([
    { id: 0, time: "14:32:05", type: "success", msg: "ORDER FILLED: BUY 0.015 BTC @ $97,432.50" },
    { id: 1, time: "14:32:04", type: "info", msg: "Sending order to Binance..." },
    { id: 2, time: "14:32:03", type: "info", msg: "Webhook received: EMA Crossover → BUY BTC/USDT" },
    { id: 3, time: "14:28:12", type: "success", msg: "ORDER FILLED: SELL 0.85 ETH @ $3,842.10" },
    { id: 4, time: "14:15:34", type: "success", msg: "ORDER FILLED: SELL 0.015 BTC @ $97,105.00" },
    { id: 5, time: "13:55:21", type: "error", msg: "ORDER REJECTED: MACD Signal paused — SOL/USDT BUY skipped" },
    { id: 6, time: "13:50:00", type: "info", msg: "System started. Listening for webhooks..." },
  ]);
  const [copied, setCopied] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("webhook");
  const [simAction, setSimAction] = useState("buy");
  const [simPair, setSimPair] = useState("BTC/USDT");
  const [simPrice, setSimPrice] = useState("97500");
  const [simQty, setSimQty] = useState("0.01");
  const logRef = useRef(null);
  const nextId = useRef(100);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  const addLog = useCallback((type, msg) => {
    setLogs((prev) => [{ id: nextId.current++, time: now(), type, msg }, ...prev]);
  }, []);

  const handleToggle = (id) => {
    setStrategies((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = s.status === "active" ? "paused" : "active";
          addLog(next === "active" ? "success" : "warn", `Strategy "${s.name}" ${next === "active" ? "RESUMED" : "PAUSED"}`);
          return { ...s, status: next };
        }
        return s;
      })
    );
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText("https://your-server.com/api/webhook/tv");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulate = () => {
    const t = now();
    const price = parseFloat(simPrice) || 0;
    const qty = parseFloat(simQty) || 0;
    const action = simAction.toUpperCase();

    addLog("info", `Webhook received: Manual Signal → ${action} ${simPair}`);
    setTimeout(() => {
      addLog("info", `Sending order to exchange...`);
    }, 300);
    setTimeout(() => {
      const filled = Math.random() > 0.2;
      if (filled) {
        addLog("success", `ORDER FILLED: ${action} ${qty} ${simPair.split("/")[0]} @ $${price.toLocaleString()}`);
      } else {
        addLog("error", `ORDER REJECTED: Insufficient balance for ${simPair} ${action}`);
      }

      const newSignal = {
        id: nextId.current++,
        time: t,
        strategy: "Manual Signal",
        pair: simPair,
        action,
        price,
        qty,
        status: filled ? "filled" : "rejected",
      };
      setSignals((prev) => [newSignal, ...prev]);
    }, 800);
  };

  const totalPnl = strategies.reduce((acc, s) => acc + s.pnl, 0);
  const activeCount = strategies.filter((s) => s.status === "active").length;
  const filledCount = signals.filter((s) => s.status === "filled").length;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="logo">TV</div>
            <h1>WebhookTrader <span>/ demo</span></h1>
          </div>
          <div className="header-right">
            <div className="status-dot" />
            <span className="status-label">LIVE</span>
          </div>
        </header>

        {/* Layout */}
        <div className="layout">
          {/* Main Content */}
          <div className="main">
            {/* Flow Diagram */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Signal Flow</span>
                <span className="card-badge" style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>ARCHITECTURE</span>
              </div>
              <div className="flow">
                <div className="flow-node" style={{ borderColor: "var(--accent-amber)", color: "var(--accent-amber)" }}>TradingView Alert</div>
                <div className="flow-arrow">→</div>
                <div className="flow-node" style={{ borderColor: "var(--accent-blue)", color: "var(--accent-blue)" }}>Webhook Server</div>
                <div className="flow-arrow">→</div>
                <div className="flow-node" style={{ borderColor: "var(--accent-purple)", color: "var(--accent-purple)" }}>Signal Parser</div>
                <div className="flow-arrow">→</div>
                <div className="flow-node" style={{ borderColor: "var(--accent-green)", color: "var(--accent-green)" }}>Exchange API</div>
                <div className="flow-arrow">→</div>
                <div className="flow-node" style={{ borderColor: "var(--accent-green)", color: "var(--accent-green)" }}>Order Executed</div>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <StatCard label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}%`} sub="All strategies" accent="green" />
              <StatCard label="Active" value={`${activeCount}/${strategies.length}`} sub="Strategies running" accent="blue" />
              <StatCard label="Signals" value={signals.length} sub={`${filledCount} filled`} accent="amber" />
              <StatCard label="Uptime" value="99.8%" sub="Last 30 days" accent="purple" />
            </div>

            {/* Strategies */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Active Strategies</span>
                <span className="card-badge" style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>{activeCount} RUNNING</span>
              </div>
              {strategies.map((s) => (
                <StrategyRow key={s.id} strategy={s} onToggle={handleToggle} />
              ))}
            </div>

            {/* Signals Table */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Recent Signals</span>
                <span className="card-badge" style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}>{signals.length} TOTAL</span>
              </div>
              <SignalTable signals={signals} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar">
            <div className="tabs">
              <button className={cn("tab", sidebarTab === "webhook" && "active")} onClick={() => setSidebarTab("webhook")}>Webhook</button>
              <button className={cn("tab", sidebarTab === "simulate" && "active")} onClick={() => setSidebarTab("simulate")}>Simulate</button>
              <button className={cn("tab", sidebarTab === "logs" && "active")} onClick={() => setSidebarTab("logs")}>Logs</button>
            </div>

            {sidebarTab === "webhook" && (
              <div className="sidebar-section" style={{ flex: 1 }}>
                <div className="sidebar-title">
                  <IconSettings size={14} /> Webhook Endpoint
                </div>
                <div className="webhook-url-box">
                  <span className="webhook-url">https://your-server.com/api/webhook/tv</span>
                  <button className="copy-btn" onClick={handleCopy}>
                    {copied ? <IconCheck size={14} color="var(--accent-green)" /> : <IconCopy size={14} />}
                  </button>
                </div>

                <div className="sidebar-title" style={{ marginTop: 20 }}>
                  <IconZap size={14} /> Payload Template
                </div>
                <div className="code-block">{WEBHOOK_TEMPLATE}</div>

                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.7 }}>
                  Paste this URL into your TradingView alert webhook field. Use the payload template above as your alert message body.
                </p>
              </div>
            )}

            {sidebarTab === "simulate" && (
              <div className="sidebar-section" style={{ flex: 1 }}>
                <div className="sidebar-title">
                  <IconSend size={14} /> Simulate Webhook
                </div>
                <div className="sim-form">
                  <div className="sim-row">
                    <div className="sim-field">
                      <label>Action</label>
                      <select value={simAction} onChange={(e) => setSimAction(e.target.value)}>
                        <option value="buy">BUY</option>
                        <option value="sell">SELL</option>
                      </select>
                    </div>
                    <div className="sim-field">
                      <label>Pair</label>
                      <select value={simPair} onChange={(e) => setSimPair(e.target.value)}>
                        <option>BTC/USDT</option>
                        <option>ETH/USDT</option>
                        <option>SOL/USDT</option>
                      </select>
                    </div>
                  </div>
                  <div className="sim-row">
                    <div className="sim-field">
                      <label>Price</label>
                      <input type="number" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} />
                    </div>
                    <div className="sim-field">
                      <label>Quantity</label>
                      <input type="number" value={simQty} onChange={(e) => setSimQty(e.target.value)} step="0.001" />
                    </div>
                  </div>
                  <button className="btn-simulate" onClick={handleSimulate}>
                    <IconSend size={15} /> Send Simulated Signal
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.7 }}>
                  Simulate a TradingView webhook to test the signal processing pipeline without connecting to a live exchange.
                </p>
              </div>
            )}

            {sidebarTab === "logs" && (
              <div className="sidebar-section log-container">
                <div className="sidebar-title">
                  <IconActivity size={14} /> Live Activity Log
                </div>
                <div className="log-entries" ref={logRef}>
                  {logs.map((l) => (
                    <LogEntry key={l.id} entry={l} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
