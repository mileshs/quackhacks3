import { useEffect, useRef, useState } from "react";
import { AudioVolumeControls } from "../components/AudioVolumeControls";
import { applyNeutralSoundtrackPlayback, getBeatAtTime, getBpmAtTime, SOUNDTRACK_ASSETS } from "../lib/audioEngine";
import { useSound } from "../providers/SoundProvider";
import { cx, eyebrow, pageGrid, pageTitle, primaryAction } from "../lib/ui";

const TEST_SOUND_PATH = "/assets/button_click.mp3";

export function SettingsPage() {
  const { soundtrackVolume, soundEffectsVolume } = useSound();
  const [tempo, setTempo] = useState({ beat: 0, bpm: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(TEST_SOUND_PATH);
    soundtrackRef.current = new Audio(SOUNDTRACK_ASSETS.speedy);
    applyNeutralSoundtrackPlayback(soundtrackRef.current);

    return () => {
      for (const ref of [audioRef, soundtrackRef]) {
        if (ref.current) {
          ref.current.pause();
          ref.current = null;
        }
      }
    };
  }, []);

  useEffect(() => {
    if (soundtrackRef.current) {
      soundtrackRef.current.volume = soundtrackVolume / 100;
    }
  }, [soundtrackVolume]);

  useEffect(() => {
    const sfxVolume = soundEffectsVolume / 100;
    if (audioRef.current) {
      audioRef.current.volume = sfxVolume;
    }
  }, [soundEffectsVolume]);

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
    applyNeutralSoundtrackPlayback(soundtrackRef.current);
    soundtrackRef.current.play().catch((err) => {
      console.warn("Soundtrack playback blocked or failed:", err);
    });
  }

  return (
    <section className={cx(pageGrid, "max-w-[720px]")}>
      <div>
        <p className={eyebrow}>Settings</p>
        <h1 className={pageTitle}>Audio</h1>
      </div>

      <div className="flex flex-col gap-8">
        <AudioVolumeControls variant="page" />

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={playTestSound}>
          Test Sound
        </button>

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={playSoundtrack}>
          Play Soundtrack
        </button>

        <p className="m-0 font-bold text-[#75e2be] tabular-nums">
          Beat {tempo.beat} &middot; {tempo.bpm ? Math.round(tempo.bpm * 10) / 10 : 0} BPM
        </p>
      </div>
    </section>
  );
}
