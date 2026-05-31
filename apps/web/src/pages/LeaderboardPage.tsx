import { FormEvent, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@quackhacks/shared";
import { api } from "../lib/api";
import { cx, eyebrow, pageGrid, pageTitle, panel, primaryAction } from "../lib/ui";

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
    <section className={pageGrid}>
      <div>
        <p className={eyebrow}>SQLite route</p>
        <h1 className={pageTitle}>Leaderboard</h1>
      </div>
      <form className={cx(panel, "mb-4 flex flex-wrap items-end gap-3 p-4")} onSubmit={addEntry}>
        <label className="grid gap-2 font-bold text-[#d8e2df]">
          Name
          <input
            className="min-h-11 rounded-md border border-white/18 bg-white/8 px-3 text-[#f6f4ea]"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
          />
        </label>
        <button className={primaryAction} type="submit">
          Add Temp Score
        </button>
      </form>
      <ol className="grid list-none gap-3 p-0">
        {entries.map((entry) => (
          <li className={cx(panel, "grid grid-cols-1 items-center gap-4 p-4 min-[861px]:grid-cols-[minmax(0,1fr)_auto_auto]")} key={entry.id}>
            <span>{entry.playerName}</span>
            <strong>{entry.score}</strong>
            <small className="text-[#aebbb8]">
              {entry.accuracy}% / {entry.survivalSeconds}s
            </small>
          </li>
        ))}
      </ol>
    </section>
  );
}
