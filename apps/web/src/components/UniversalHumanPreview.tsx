import { universalHumanSize, universalLimbs, type UniversalPose } from "@quackhacks/shared";

type UniversalHumanPreviewProps = {
  pose: UniversalPose;
};

export function UniversalHumanPreview({ pose }: UniversalHumanPreviewProps) {
  const jointMap = new Map(pose.joints.map((joint) => [joint.name, joint]));

  return (
    <svg
      className="human-preview"
      viewBox={`0 0 ${universalHumanSize.width} ${universalHumanSize.height}`}
      role="img"
      aria-label={pose.name}
    >
      <rect x="18" y="18" width="284" height="430" rx="18" className="preview-zone" />
      <line x1="38" y1="448" x2="282" y2="448" className="floor-line" />
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
            className="limb-line"
          />
        );
      })}
      {pose.joints.map((joint) => (
        <circle
          key={joint.name}
          cx={joint.x * universalHumanSize.width}
          cy={joint.y * universalHumanSize.height}
          r={joint.name === "head" ? 12 : 7}
          className="joint-dot"
        />
      ))}
    </svg>
  );
}
