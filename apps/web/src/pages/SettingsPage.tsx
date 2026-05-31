import { cx, eyebrow, pageGrid, pageTitle, panel, primaryAction, secondaryAction } from "../lib/ui";
import { useSound } from "../providers/SoundProvider";

export function SettingsPage() {
  const {
    soundtrackVolume,
    soundEffectsVolume,
    tempo,
    setSoundtrackVolume,
    setSoundEffectsVolume,
    playSoundEffect,
    playSoundtrack,
    triggerTimeWarp,
  } = useSound();

  return (
    <section className={cx(pageGrid, "max-w-[720px]")}>
      <div>
        <p className={eyebrow}>Settings</p>
        <h1 className={pageTitle}>Audio</h1>
      </div>

      <div className="flex flex-col gap-8">
        <label className={cx(panel, "grid gap-2 p-4 font-bold text-[#d8e2df]")}>
          Soundtrack Volume
          <input
            className="w-full accent-[#ffd65c]"
            type="range"
            min="0"
            max="100"
            value={soundtrackVolume}
            onChange={(event) => setSoundtrackVolume(Number(event.target.value))}
          />
          <output>{soundtrackVolume}%</output>
        </label>

        <label className={cx(panel, "grid gap-2 p-4 font-bold text-[#d8e2df]")}>
          Sound Effects Volume
          <input
            className="w-full accent-[#ffd65c]"
            type="range"
            min="0"
            max="100"
            value={soundEffectsVolume}
            onChange={(event) => setSoundEffectsVolume(Number(event.target.value))}
          />
          <output>{soundEffectsVolume}%</output>
        </label>

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={() => playSoundEffect("shieldUp")}>
          Test Sound
        </button>

        <button className={cx(primaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={() => playSoundtrack("speedy")}>
          Play Soundtrack
        </button>

        <button className={cx(secondaryAction, "max-w-[12.5rem] self-start")} type="button" onClick={() => triggerTimeWarp()}>
          Time Warp
        </button>

        <p className="m-0 font-bold text-[#75e2be] tabular-nums">
          Beat {tempo.beat} &middot; {tempo.bpm ? Math.round(tempo.bpm * 10) / 10 : 0} BPM
        </p>
      </div>
    </section>
  );
}
