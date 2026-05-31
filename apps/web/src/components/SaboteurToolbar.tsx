import {
  AddPoseIcon,
  CancelPoseIcon,
  EditPoseIcon,
  MakePoseIcon,
  PreviewHoleIcon,
  SendPoseIcon
} from "./SaboteurIconButton";
import { SaboteurToolButton } from "./SaboteurToolButton";
import { cx, panel } from "../lib/ui";

type SaboteurToolbarProps = {
  draftActive: boolean;
  showHole: boolean;
  saveError: string | null;
  onMakePose: () => void;
  onEditPose: () => void;
  onCancelDraft: () => void;
  onToggleHole: () => void;
  onSavePose: () => void;
  onSendPose: () => void;
};

export function SaboteurToolbar({
  draftActive,
  showHole,
  saveError,
  onMakePose,
  onEditPose,
  onCancelDraft,
  onToggleHole,
  onSavePose,
  onSendPose
}: SaboteurToolbarProps) {
  return (
    <div className={cx(panel, "flex flex-col gap-3 p-4")}>
      <h3 className="m-0 text-[11px] font-extrabold tracking-[0.14em] text-[#8a8274] uppercase">Saboteur Tools</h3>

      <div className="flex flex-wrap gap-2">
        <SaboteurToolButton label="Make Pose" hint="Start a fresh T-pose" onClick={onMakePose}>
          <MakePoseIcon />
        </SaboteurToolButton>
        <SaboteurToolButton label="Edit Pose" hint="Drag joints to adjust" onClick={onEditPose} disabled={draftActive}>
          <EditPoseIcon />
        </SaboteurToolButton>
        {draftActive ? (
          <SaboteurToolButton label="Cancel" hint="Discard changes" onClick={onCancelDraft}>
            <CancelPoseIcon />
          </SaboteurToolButton>
        ) : null}
        <SaboteurToolButton
          label={showHole ? "Hide Hole" : "Preview Hole"}
          hint="See the wall cutout"
          active={showHole}
          onClick={onToggleHole}
        >
          <PreviewHoleIcon />
        </SaboteurToolButton>
        <SaboteurToolButton label="Save Pose" hint="Add to your deck" onClick={onSavePose} disabled={!draftActive}>
          <AddPoseIcon />
        </SaboteurToolButton>
        <SaboteurToolButton label="Send Pose" hint="Push to the poser" onClick={onSendPose}>
          <SendPoseIcon />
        </SaboteurToolButton>
      </div>

      {saveError ? (
        <p className="m-0 text-sm font-semibold text-[#ff8585]" role="alert">
          {saveError}
        </p>
      ) : null}
    </div>
  );
}
