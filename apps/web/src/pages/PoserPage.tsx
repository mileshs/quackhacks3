import { useEffect, useState } from "react";
import { starterPoses } from "@quackhacks/shared";
import { UniversalHumanPreview } from "../components/UniversalHumanPreview";
import { createHonoWebSocket } from "../lib/realtime";

export function PoserPage() {
  const [message, setMessage] = useState("Connecting to Hono WebSocket");
  const pose = starterPoses[0];

  useEffect(() => {
    const ws = createHonoWebSocket();

    ws.addEventListener("open", () => {
      ws.send("poser-screen-ready");
    });

    ws.addEventListener("message", (event) => {
      setMessage(String(event.data));
    });

    ws.addEventListener("error", () => {
      setMessage("Hono WebSocket unavailable");
    });

    return () => {
      ws.close();
    };
  }, []);

  return (
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">Athlete display</p>
        <h1>Poser Screen</h1>
      </div>
      <div className="split-layout">
        <UniversalHumanPreview pose={pose} />
        <div className="tool-panel">
          <h2>Universal Human</h2>
          <p className="large-status">{pose.name}</p>
          <code>{message}</code>
        </div>
      </div>
    </section>
  );
}
