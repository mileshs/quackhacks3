import { Link } from "react-router-dom";
import { ApiStatusPanel } from "../components/ApiStatusPanel";

export function HomePage() {
  return (
    <section className="hero-page">
      <div className="hero-background" />
      <div className="hero-content">
        <p className="eyebrow">Pose wall survival</p>
        <h1>QuackHacks 3</h1>
        <p className="hero-copy">
          A working shell for the athlete, saboteur, realtime, camera, and leaderboard systems.
        </p>
        <div className="hero-actions">
          <Link className="primary-action" to="/game">
            Open Game Shell
          </Link>
          <Link className="secondary-action" to="/pose-test">
            Pose Test
          </Link>
        </div>
      </div>
      <ApiStatusPanel />
    </section>
  );
}
