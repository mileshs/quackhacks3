import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cx, metricLabel, metricValue, panel } from "../lib/ui";

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
    <section className={cx(panel, "relative p-5")} aria-label="API status">
      <div className="mb-4 flex items-center gap-2">
        <span className={cx("inline-block size-3 rounded-full", health?.ok ? "bg-[#75e2be]" : "bg-[#ef5c6b]")} />
        <strong>{health?.ok ? "API online" : "API pending"}</strong>
      </div>
      {health ? (
        <dl className="m-0 grid gap-3">
          <div>
            <dt className={metricLabel}>D1 rows</dt>
            <dd className={metricValue}>{health.database.leaderboardEntries}</dd>
          </div>
          <div>
            <dt className={metricLabel}>WebSocket</dt>
            <dd className={metricValue}>{health.realtime.websocket}</dd>
          </div>
          <div>
            <dt className={metricLabel}>Coordinator</dt>
            <dd className={metricValue}>{health.realtime.coordinator}</dd>
          </div>
        </dl>
      ) : (
        <p className="m-0">{error ?? "Checking local server"}</p>
      )}
    </section>
  );
}
