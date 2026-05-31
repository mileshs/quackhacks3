import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { canvasStage, eyebrow, pageGrid, pageTitle, primaryAction, secondaryAction, splitLayout, toolPanel } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

export function GamePage() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const { connectionStatus, game, startGame, endGame } = useActiveGame();
  const isGameActive = game?.activeGame ?? false;

  useEffect(() => {
    let sketch: { remove: () => void } | undefined;
    let cancelled = false;

    import("p5").then((module) => {
      if (cancelled || !canvasMountRef.current) {
        return;
      }

      const P5 = module.default;

      sketch = new P5((p) => {
        p.setup = () => {
          p.createCanvas(560, 280);
        };

        p.draw = () => {
          p.background(12, 18, 26);
          p.noStroke();
          p.fill(255, 214, 92);
          const beat = Math.floor((p.frameCount / 30) % 8) + 1;
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(24);
          p.text(`8-count beat ${beat}`, p.width / 2, 48);

          p.stroke(117, 226, 190);
          p.strokeWeight(8);
          p.noFill();
          p.rect(120 + beat * 10, 92, 280, 128, 12);

          p.noStroke();
          p.fill(238, 92, 107);
          p.circle(160 + beat * 28, 156, 42);
        };
      }, canvasMountRef.current);
    });

    return () => {
      cancelled = true;
      sketch?.remove();
    };
  }, []);

  return (
    <section className={pageGrid}>
      <div>
        <p className={eyebrow}>Temp game route</p>
        <h1 className={pageTitle}>Game Shell</h1>
      </div>
      <div className={splitLayout}>
        <div className={canvasStage} ref={canvasMountRef} />
        <aside className={toolPanel}>
          <h2 className="m-0 text-lg font-bold">Game Session</h2>
          <p className="m-0 text-sm font-semibold text-[#aebbb8]">
            {isGameActive ? `Active game ${game?.gameId?.slice(0, 8) ?? ""}` : "No active game"}
          </p>
          <p className="m-0 text-sm text-[#aebbb8]">
            {game ? `${game.playerCount} connected client${game.playerCount === 1 ? "" : "s"}` : connectionStatus}
          </p>
          <button className={primaryAction} type="button" onClick={startGame}>
            {isGameActive ? "Join Game" : "New Game"}
          </button>
          {isGameActive ? (
            <button className={secondaryAction} type="button" onClick={endGame}>
              End Game
            </button>
          ) : null}
          <h2 className="m-0 text-lg font-bold">Debug Screens</h2>
          <Link className={primaryAction} to="/saboteur">
            Saboteur Option
          </Link>
          <Link className={secondaryAction} to="/score">
            Score Page
          </Link>
        </aside>
      </div>
    </section>
  );
}
