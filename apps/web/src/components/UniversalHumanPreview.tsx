import { universalHumanSize, universalLimbs, type UniversalPose } from "@quackhacks/shared";
import { floorLine, humanPreview, jointDot, limbLine, previewZone } from "../lib/ui";

type UniversalHumanPreviewProps = {
  pose: UniversalPose;
};

export function UniversalHumanPreview({ pose }: UniversalHumanPreviewProps) {
  const jointMap = new Map(pose.joints.map((joint) => [joint.name, joint]));

  return (
    <svg
      className={humanPreview}
      viewBox={`0 0 ${universalHumanSize.width} ${universalHumanSize.height}`}
      role="img"
      aria-label={pose.name}
    >
      <rect x="18" y="18" width="284" height="430" rx="18" className={previewZone} />
      <line x1="38" y1="448" x2="282" y2="448" className={floorLine} strokeLinecap="round" />
      {universalLimbs.map(([from, to]) => {
        const fromJoint = jointMap.get(from);
        const toJoint = jointMap.get(to);

        if (!fromJoint || !toJoint) {
          return null;
        }

        return (
          <line
            key={`${from}-${to}`}
            x1={fromJoint.x * universalHumanSize.width}
            y1={fromJoint.y * universalHumanSize.height}
            x2={toJoint.x * universalHumanSize.width}
            y2={toJoint.y * universalHumanSize.height}
            className={limbLine}
            strokeLinecap="round"
          />
        );
      })}
      {pose.joints.map((joint) => (
        <circle
          key={joint.name}
          cx={joint.x * universalHumanSize.width}
          cy={joint.y * universalHumanSize.height}
          r={joint.name === "head" ? 12 : 7}
          className={jointDot}
        />
      ))}
    </svg>
  );
}
