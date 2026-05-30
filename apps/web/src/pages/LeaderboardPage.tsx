import { FormEvent, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@quackhacks/shared";
import { api } from "../lib/api";

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState("Local Duck");

  async function loadEntries() {
    const response = await api.api.leaderboard.$get();
    const data = await response.json();
    setEntries(data.entries);
  }

  useEffect(() => {
    loadEntries();
  }, []);

  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await api.api.leaderboard.$post({
      json: {
        playerName,
        score: Math.floor(50 + Math.random() * 50),
        accuracy: Math.round((70 + Math.random() * 30) * 10) / 10,
        survivalSeconds: Math.floor(45 + Math.random() * 90)
      }
    });

    await loadEntries();
  }

  return (
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">SQLite route</p>
        <h1>Leaderboard</h1>
      </div>
      <form className="leaderboard-form" onSubmit={addEntry}>
        <label>
          Name
          <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
        </label>
        <button className="primary-action" type="submit">
          Add Temp Score
        </button>
      </form>
      <ol className="leaderboard-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span>{entry.playerName}</span>
            <strong>{entry.score}</strong>
            <small>
              {entry.accuracy}% / {entry.survivalSeconds}s
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}
