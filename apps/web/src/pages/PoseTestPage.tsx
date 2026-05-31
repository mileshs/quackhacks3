import { useEffect, useMemo, useState } from "react";
import { GameRole, starterPoses, type UniversalPose } from "@quackhacks/shared";
import { useNavigate } from "react-router-dom";
import { AthleteStage } from "../components/AthleteStage";
import { DummySplash } from "../components/DummySplash";
import { loadSavedPoses } from "../lib/savedPoses";
import { secondaryAction } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

const DUMMY_SPLASH_SEEN_KEY = "quackhacks:dummy:splashSeen";

export function PoseTestPage() {
  const navigate = useNavigate();
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);
  const [previewPose, setPreviewPose] = useState<UniversalPose | null>(null);
  const [selectedId, setSelectedId] = useState(starterPoses[0]?.id ?? "");
  const {
    claimedRole,
    claimRole,
    connectionStatus,
    game,
    lastPose,
    lastPowerup,
    roleError,
    sendRoleHeartbeat,
    sendRoundSnapshot
  } = useActiveGame();
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(DUMMY_SPLASH_SEEN_KEY) !== "true";
  });

  useEffect(() => {
    const refresh = () => setSavedPoses(loadSavedPoses());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (lastPose?.joints) {
      setPreviewPose(lastPose);
      setSelectedId(lastPose.id);
    }
  }, [lastPose]);

  const poseOptions = useMemo(() => {
    const base = [...starterPoses, ...savedPoses];
    if (previewPose && !base.some((pose) => pose.id === previewPose.id)) {
      return [...base, previewPose];
    }
    return base;
  }, [savedPoses, previewPose]);
  const targetPose = previewPose ?? poseOptions.find((pose) => pose.id === selectedId) ?? poseOptions[0] ?? starterPoses[0];

  useEffect(() => {
    if (connectionStatus === "connected" && game?.activeGame && claimedRole !== GameRole.Dummy && !roleError) {
      claimRole(GameRole.Dummy);
    }
  }, [claimRole, claimedRole, connectionStatus, game?.activeGame, roleError]);

  useEffect(() => {
    if (claimedRole !== GameRole.Dummy) {
      return;
    }

    sendRoleHeartbeat(GameRole.Dummy);
    const intervalId = window.setInterval(() => sendRoleHeartbeat(GameRole.Dummy), 5_000);

    return () => window.clearInterval(intervalId);
  }, [claimedRole, sendRoleHeartbeat]);

  useEffect(() => {
    if (game && !game.activeGame) {
      if (game.endReason === "role-disconnected" || game.endReason === "role-timeout") {
        window.localStorage.setItem("quackhacks:gameEndNotice", "A player disconnected, so the game ended.");
      }

      navigate("/");
    }
  }, [game, navigate]);

  useEffect(() => {
    if (roleError) {
      window.localStorage.setItem("quackhacks:gameEndNotice", "That role is not available anymore.");
      navigate("/");
    }
  }, [navigate, roleError]);

  function dismissSplash() {
    setShowSplash(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DUMMY_SPLASH_SEEN_KEY, "true");
    }
  }

  return (
    <>
      {showSplash ? <DummySplash onDismiss={dismissSplash} /> : null}
      <div className="absolute top-18 right-4 z-10">
        <button className={secondaryAction} type="button" onClick={() => setShowSplash(true)}>
          Replay Intro
        </button>
      </div>
      <AthleteStage
        targetPose={targetPose}
        poseOptions={poseOptions}
        savedPoseIds={savedPoses.map((pose) => pose.id)}
        selectedPoseId={targetPose.id}
        onSelectPose={(pose) => setSelectedId(pose.id)}
        powerupActivation={lastPowerup}
        onFinishWall={sendRoundSnapshot}
      />
    </>
  );
}
