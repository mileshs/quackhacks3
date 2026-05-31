import { Link } from "react-router-dom";
import { scoreBandFromMatch, scoreFromMatch } from "@quackhacks/shared";
import { cx, eyebrow, heroActions, metricLabel, metricValue, primaryAction, secondaryAction } from "../lib/ui";

export function ScorePage() {
  const accuracy = 86;
  const score = scoreFromMatch(accuracy);
  const band = scoreBandFromMatch(accuracy);

  return (
    <section className="relative grid min-h-[calc(100dvh-66px)] place-items-center p-8 text-center">
      <div>
        <p className={eyebrow}>Run complete</p>
        <h1 className="mt-0 mb-4 text-[clamp(3rem,8vw,6.75rem)] leading-[0.95] font-bold text-[#ffd65c]">{band}</h1>
      <dl className="mb-6 grid grid-cols-1 gap-3 min-[861px]:grid-cols-3">
        <div className={cx("rounded-lg border border-[#f6f4ea]/16 bg-white/8 p-4")}>
          <dt className={metricLabel}>Accuracy</dt>
          <dd className={metricValue}>{accuracy}%</dd>
        </div>
        <div className={cx("rounded-lg border border-[#f6f4ea]/16 bg-white/8 p-4")}>
          <dt className={metricLabel}>Score</dt>
          <dd className={metricValue}>{score}</dd>
        </div>
        <div className={cx("rounded-lg border border-[#f6f4ea]/16 bg-white/8 p-4")}>
          <dt className={metricLabel}>Survival</dt>
          <dd className={metricValue}>1:34</dd>
        </div>
      </dl>
      <div className={cx(heroActions, "justify-center")}>
        <Link className={primaryAction} to="/">
          Play Again
        </Link>
        <Link className={secondaryAction} to="/saboteur">
          Swap Roles
        </Link>
      </div>
      </div>
    </section>
  );
}
