import {
  AddPoseIcon,
  CancelPoseIcon,
  EditPoseIcon,
  MakePoseIcon,
  PreviewHoleIcon,
  SendPoseIcon
} from "./SaboteurIconButton";
import { SaboteurToolButton } from "./SaboteurToolButton";
import { cx, saboteurTile } from "../lib/ui";

type SaboteurToolbarProps = {
  draftActive: boolean;
  showHole: boolean;
  onMakePose: () => void;
  onEditPose: () => void;
  onCancelDraft: () => void;
  onToggleHole: () => void;
  onSavePose: () => void;
  onSendPose: () => void;
  onStartTutorial: () => void;
};

export function SaboteurToolbar({
  draftActive,
  showHole,
  onMakePose,
  onEditPose,
  onCancelDraft,
  onToggleHole,
  onSavePose,
  onSendPose,
  onStartTutorial
}: SaboteurToolbarProps) {
  return (
    <div className="shrink-0 border-t border-white/8 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-2">
        <SaboteurToolButton compact label="Make Pose" hint="Start a fresh T-pose" onClick={onMakePose}>
          <MakePoseIcon />
        </SaboteurToolButton>
        <SaboteurToolButton compact label="Edit Pose" hint="Drag joints to adjust" onClick={onEditPose} disabled={draftActive}>
          <EditPoseIcon />
        </SaboteurToolButton>
        {draftActive ? (
          <SaboteurToolButton compact label="Cancel" hint="Discard changes" onClick={onCancelDraft}>
            <CancelPoseIcon />
          </SaboteurToolButton>
        ) : null}
        <SaboteurToolButton
          compact
          label={showHole ? "Hide Hole" : "Preview Hole"}
          hint="See the wall cutout"
          active={showHole}
          onClick={onToggleHole}
        >
          <PreviewHoleIcon />
        </SaboteurToolButton>
        <SaboteurToolButton compact label="Save Pose" hint="Add to your deck" onClick={onSavePose} disabled={!draftActive}>
          <AddPoseIcon />
        </SaboteurToolButton>
        <SaboteurToolButton compact label="Send Pose" hint="Push to the poser" onClick={onSendPose}>
          <SendPoseIcon />
        </SaboteurToolButton>
        </div>

        <button
          type="button"
          className={cx(
            saboteurTile,
            "inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-base font-extrabold text-[#ece8e0] transition-transform active:translate-y-px"
          )}
          aria-label="Play tutorial. Learn how to use the saboteur controls."
          onClick={onStartTutorial}
        >
          ?
        </button>
      </div>
    </div>
  );
}
