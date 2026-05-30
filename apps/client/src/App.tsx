import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@quackhacks/shared";
import { SocketEvents } from "@quackhacks/shared";
import { api } from "./api";
import { socket } from "./socket";

// This page is NOT the game. It's a smoke test proving every piece of the
// stack is wired: typed Hono client, sqlite-backed leaderboard, socket.io,
// and the native Hono websocket endpoint.
export function App() {
  const [health, setHealth] = useState<string>("…");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [socketStatus, setSocketStatus] = useState("disconnected");
  const [wsLog, setWsLog] = useState<string[]>([]);

  async function loadLeaderboard() {
    const res = await api.api.leaderboard.$get({ query: { limit: "10" } });
    const data = await res.json();
    setEntries(data.entries);
  }

  async function checkHealth() {
    try {
      const res = await api.api.health.$get();
      const data = await res.json();
      setHealth(JSON.stringify(data));
    } catch (e) {
      setHealth(`error: ${String(e)}`);
    }
  }

  async function addRandomScore() {
    await api.api.leaderboard.$post({
      json: {
        name: `Player${Math.floor(Math.random() * 1000)}`,
        score: Math.floor(Math.random() * 100),
        survivalTime: Math.round(Math.random() * 120),
      },
    });
    await loadLeaderboard();
  }

  function connectSocket() {
    socket.connect();
    socket.on("connect", () => setSocketStatus(`connected (${socket.id})`));
    socket.on("disconnect", () => setSocketStatus("disconnected"));
    socket.emit(SocketEvents.JoinRoom, "test-room");
  }

  function testHonoWs() {
    const ws = new WebSocket(`ws://${location.host}/ws`);
    ws.onmessage = (e) => setWsLog((l) => [...l, `recv: ${e.data}`]);
    ws.onopen = () => {
      setWsLog((l) => [...l, "open"]);
      ws.send("ping from client");
    };
  }

  useEffect(() => {
    checkHealth();
    loadLeaderboard().catch(() => {});
  }, []);

  return (
    <main>
      <h1>🪟 QuackHacks 3 — Stack Smoke Test</h1>
      <p className="status">
        Scaffold only. Use this page to confirm the backend pieces respond.
      </p>

      <section>
        <h2>Server health (Hono RPC client)</h2>
        <pre>{health}</pre>
        <button onClick={checkHealth}>Re-check</button>
      </section>

      <section>
        <h2>Leaderboard (sqlite)</h2>
        <button onClick={addRandomScore}>Add random score</button>{" "}
        <button onClick={loadLeaderboard}>Refresh</button>
        <ol>
          {entries.map((e) => (
            <li key={e.id}>
              {e.name} — {e.score} pts, {e.survivalTime}s
            </li>
          ))}
        </ol>
        {entries.length === 0 && <p className="status">No scores yet.</p>}
      </section>

      <section>
        <h2>socket.io</h2>
        <p className="status">
          Status:{" "}
          <span className={socketStatus.startsWith("connected") ? "ok" : "err"}>
            {socketStatus}
          </span>
        </p>
        <button onClick={connectSocket}>Connect & join room</button>
      </section>

      <section>
        <h2>Hono native websocket (/ws echo)</h2>
        <button onClick={testHonoWs}>Open & ping</button>
        <pre>{wsLog.join("\n") || "(no messages)"}</pre>
      </section>
    </main>
  );
}
