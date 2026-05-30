import { useEffect, useState } from "react";
import { api } from "../lib/api";

type HealthStatus = Awaited<ReturnType<Awaited<ReturnType<typeof api.api.health.$get>>["json"]>>;

export function ApiStatusPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    api.api.health
      .$get()
      .then((response) => response.json())
      .then((data) => {
        if (isMounted) {
          setHealth(data);
        }
      })
      .catch((caught: unknown) => {
        if (isMounted) {
          setError(caught instanceof Error ? caught.message : "Unable to reach API");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="status-panel" aria-label="API status">
      <div>
        <span className={health?.ok ? "status-dot online" : "status-dot"} />
        <strong>{health?.ok ? "API online" : "API pending"}</strong>
      </div>
      {health ? (
        <dl>
          <div>
            <dt>SQLite rows</dt>
            <dd>{health.database.leaderboardEntries}</dd>
          </div>
          <div>
            <dt>Hono WS</dt>
            <dd>{health.realtime.honoWebSocket}</dd>
          </div>
          <div>
            <dt>Socket.IO</dt>
            <dd>{health.realtime.socketIo}</dd>
          </div>
        </dl>
      ) : (
        <p>{error ?? "Checking local server"}</p>
      )}
    </section>
  );
}
