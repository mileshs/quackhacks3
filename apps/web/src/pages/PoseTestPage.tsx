import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameRole, starterPoses, type UniversalPose } from "@quackhacks/shared";
import { useNavigate } from "react-router-dom";
import { AthleteStage } from "../components/AthleteStage";
import { DummySplash } from "../components/DummySplash";
import { RoleGameShell } from "../components/RoleGameShell";
import { showGameNotice } from "../lib/gameNotifications";
import {
  appendCaptureFrame,
  buildScorePath,
  readRememberedCaptureSession,
  rememberCaptureSession,
  resetCaptureSessionKey,
  resolveCaptureSessionKey
} from "../lib/gameCapture";
import type { GameCaptureImages } from "../lib/gameCapture";
import { loadSavedPoses } from "../lib/savedPoses";
import { secondaryAction } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

export function PoseTestPage() {
  const navigate = useNavigate();
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);
  const [previewPose, setPreviewPose] = useState<UniversalPose | null>(null);
  const [selectedId, setSelectedId] = useState(starterPoses[0]?.id ?? "");
  const gameControls = useActiveGame();
  const { game, lastPose, lastPowerup, sendRoundSnapshot, defeatGame } = gameControls;
  const [showSplash, setShowSplash] = useState(true);
  const roundIndexRef = useRef(0);

  const gameSessionKey = game?.gameId ?? game?.playingStartedAt ?? null;

  useEffect(() => {
    roundIndexRef.current = 0;
    resetCaptureSessionKey(gameSessionKey);
  }, [gameSessionKey]);

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
  const savedPoseIds = useMemo(() => savedPoses.map((pose) => pose.id), [savedPoses]);
  const targetPose = previewPose ?? poseOptions.find((pose) => pose.id === selectedId) ?? poseOptions[0] ?? starterPoses[0];
  const handleSelectPose = useCallback((pose: UniversalPose) => setSelectedId(pose.id), []);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const showIntro = useCallback(() => setShowSplash(true), []);

  const persistCapture = useCallback(
    (capture: GameCaptureImages) => {
      const key = resolveCaptureSessionKey(game?.gameId, game?.playingStartedAt);
      roundIndexRef.current += 1;
      rememberCaptureSession(key);
      appendCaptureFrame(key, roundIndexRef.current, capture);
      return key;
    },
    [game?.gameId, game?.playingStartedAt]
  );

  const handleRoundCapture = useCallback(
    (capture: GameCaptureImages) => {
      persistCapture(capture);
    },
    [persistCapture]
  );

  const handleCaptureShot = useCallback(
    (capture: GameCaptureImages) => {
      persistCapture(capture);
      showGameNotice("Capture saved. Use Dev → I Won to preview on the score screen.");
    },
    [persistCapture]
  );

  const handleAllLivesLost = useCallback(() => {
    const key =
      resolveCaptureSessionKey(game?.gameId, game?.playingStartedAt) ??
      readRememberedCaptureSession();

    if (key) {
      rememberCaptureSession(key);
    }

    if (game?.activeGame) {
      defeatGame();
      return;
    }

    navigate(buildScorePath("saboteur", key ?? undefined));
  }, [defeatGame, game?.activeGame, game?.gameId, game?.playingStartedAt, navigate]);

  return (
    <>
      {showSplash ? <DummySplash onDismiss={dismissSplash} /> : null}
      <RoleGameShell role={GameRole.Dummy} controls={gameControls}>
        <div className="absolute top-18 right-4 z-10">
          <button className={secondaryAction} type="button" onClick={showIntro}>
            Replay Intro
          </button>
        </div>
        <AthleteStage
          targetPose={targetPose}
          poseOptions={poseOptions}
          savedPoseIds={savedPoseIds}
          selectedPoseId={targetPose.id}
          onSelectPose={handleSelectPose}
          powerupActivation={lastPowerup}
          onFinishWall={sendRoundSnapshot}
          playingSessionKey={game?.playingStartedAt ?? null}
          onAllLivesLost={handleAllLivesLost}
          onRoundCapture={handleRoundCapture}
          capturePosePool={poseOptions}
          onCaptureShot={handleCaptureShot}
        />
      </RoleGameShell>
    </>
  );
}
