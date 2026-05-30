import { useEffect, useRef, useState } from "react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const savedVolume = parseStoredVolume(window.localStorage.getItem(volumeStorageKey));

    if (savedVolume !== null) {
      setVolume(savedVolume);
    }

    audioRef.current = new Audio(TEST_SOUND_PATH);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

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

  return (
    <section className="page-grid settings-page">
      <div className="page-heading">
        <p className="eyebrow">Settings</p>
        <h1>Audio</h1>
      </div>

      <div className="settings-controls">
        <label className="range-control">
          Volume
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
          />
          <output>{volume}%</output>
        </label>

        <button className="primary-action" type="button" onClick={playTestSound}>
          Test Sound
        </button>
      </div>
    </section>
  );
}
