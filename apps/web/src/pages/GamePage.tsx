import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export function GamePage() {
  const canvasMountRef = useRef<HTMLDivElement>(null);

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
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">Temp game route</p>
        <h1>Game Shell</h1>
      </div>
      <div className="game-layout">
        <div className="canvas-stage" ref={canvasMountRef} />
        <aside className="tool-panel">
          <h2>Debug Screens</h2>
          <Link className="primary-action" to="/saboteur">
            Saboteur Option
          </Link>
          <Link className="secondary-action" to="/score">
            Score Page
          </Link>
        </aside>
      </div>
    </section>
  );
}
