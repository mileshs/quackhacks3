import { useEffect, useRef, useState } from "react";
import { AUDIO_ASSETS, getBeatAtTime, getBpmAtTime, startTimeWarp } from "../lib/audioEngine";
import { cx, eyebrow, pageGrid, pageTitle, panel, primaryAction, secondaryAction } from "../lib/ui";

const volumeStorageKey = "quackhacks.volume";
const TEST_SOUND_PATH = "/assets/shield_up.mp3";

function parseStoredVolume(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

export function SettingsPage() {
  const [volume, setVolume] = useState(70);
  const [tempo, setTempo] = useState({ beat: 0, bpm: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);
  const timeWarpSfxRef = useRef<HTMLAudioElement | null>(null);
  const timeWarpCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const savedVolume = parseStoredVolume(window.localStorage.getItem(volumeStorageKey));

    if (savedVolume !== null) {
      setVolume(savedVolume);
    }

    audioRef.current = new Audio(TEST_SOUND_PATH);
    soundtrackRef.current = new Audio(AUDIO_ASSETS.soundtrackSpeedy);
    timeWarpSfxRef.current = new Audio(AUDIO_ASSETS.timeWarp);

    return () => {
      timeWarpCancelRef.current?.();
      timeWarpCancelRef.current = null;

      for (const ref of [audioRef, soundtrackRef, timeWarpSfxRef]) {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
    if (soundtrackRef.current) {
      soundtrackRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Live beat counter / BPM, derived from the soundtrack's playback position.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const track = soundtrackRef.current;
      if (!track) {
        return;
      }

      setTempo({
        beat: Math.floor(getBeatAtTime(track.currentTime, track.duration)),
        bpm: getBpmAtTime(track.currentTime, track.duration),
      });
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  function updateVolume(nextVolume: number) {
    setVolume(nextVolume);
    window.localStorage.setItem(volumeStorageKey, String(nextVolume));
  }

  function playTestSound() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err) => {
      console.warn("Audio playback blocked or failed:", err);
    });
  }

  function playSoundtrack() {
    if (!soundtrackRef.current) {
      return;
    }

    soundtrackRef.current.currentTime = 0;
    soundtrackRef.current.playbackRate = 1;
    soundtrackRef.current.play().catch((err) => {
      console.warn("Soundtrack playback blocked or failed:", err);
    });
  }

  function triggerTimeWarp() {
    timeWarpCancelRef.current?.();
    timeWarpCancelRef.current = null;

    if (soundtrackRef.current && timeWarpSfxRef.current) {
      timeWarpCancelRef.current = startTimeWarp(soundtrackRef.current, timeWarpSfxRef.current, {
        masterVolume: volume / 100,
      });
    }
  }

  return (
    <section className={cx(pageGrid, "max-w-[720px]")}>
      <div>
        <p className={eyebrow}>Settings</p>
        <h1 className={pageTitle}>Audio</h1>
      </div>

      <div className="flex flex-col gap-8">
        <label className={cx(panel, "grid gap-2 p-4 font-bold text-[#d8e2df]")}>
          Volume
          <input
            className="w-full accent-[#ffd65c]"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
          />
          <output>{volume}%</output>
        </label>

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={playTestSound}>
          Test Sound
        </button>

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={playSoundtrack}>
          Play Soundtrack
        </button>

        <button className={cx(secondaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={triggerTimeWarp}>
          Time Warp
        </button>

        <p className="m-0 font-bold text-[#75e2be] tabular-nums">
          Beat {tempo.beat} &middot; {tempo.bpm ? Math.round(tempo.bpm * 10) / 10 : 0} BPM
        </p>
      </div>
    </section>
  );
}
