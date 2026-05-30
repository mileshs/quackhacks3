import { Link } from "react-router-dom";
import { scoreBandFromMatch, scoreFromMatch } from "@quackhacks/shared";

export function ScorePage() {
  const accuracy = 86;
  const score = scoreFromMatch(accuracy);
  const band = scoreBandFromMatch(accuracy);

  return (
    <section className="score-page">
      <p className="eyebrow">Run complete</p>
      <h1>{band}</h1>
      <dl className="score-stats">
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracy}%</dd>
        </div>
        <div>
          <dt>Score</dt>
          <dd>{score}</dd>
        </div>
        <div>
          <dt>Survival</dt>
          <dd>1:34</dd>
        </div>
      </dl>
      <div className="hero-actions">
        <Link className="primary-action" to="/game">
          Play Again
        </Link>
        <Link className="secondary-action" to="/saboteur">
          Swap Roles
        </Link>
      </div>
    </section>
  );
}
