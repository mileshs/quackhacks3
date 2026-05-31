import {
  AddPoseIcon,
  CancelPoseIcon,
  EditPoseIcon,
  MakePoseIcon,
  PreviewHoleIcon,
  SendPoseIcon
} from "./SaboteurIconButton";
import { SaboteurToolButton } from "./SaboteurToolButton";

type SaboteurToolbarProps = {
  draftActive: boolean;
  showHole: boolean;
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
  onMakePose,
  onEditPose,
  onCancelDraft,
  onToggleHole,
  onSavePose,
  onSendPose
}: SaboteurToolbarProps) {
  return (
    <div className="shrink-0 border-t border-white/8 px-3 py-2.5">
      <div className="flex flex-wrap justify-center gap-2">
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
    </div>
  );
}
