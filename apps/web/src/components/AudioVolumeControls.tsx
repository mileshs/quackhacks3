import { useSound } from "../providers/SoundProvider";
import { cx, panel } from "../lib/ui";

type AudioVolumeControlsProps = {
  variant: "menu" | "page";
};

type VolumeRowProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  variant: "menu" | "page";
  accentClass: string;
};

function VolumeRow({ label, value, onChange, ariaLabel, variant, accentClass }: VolumeRowProps) {
  if (variant === "menu") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a89a82] uppercase">{label}</span>
          <span className="text-sm font-black tabular-nums">{value}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cx("w-full", accentClass)}
          aria-label={ariaLabel}
        />
      </div>
    );
  }

  return (
    <label className={cx(panel, "grid gap-2 p-4 font-bold text-[#d8e2df]")}>
      {label}
      <input
        className={cx("w-full", accentClass)}
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={ariaLabel}
      />
      <output>{value}%</output>
    </label>
  );
}

export function AudioVolumeControls({ variant }: AudioVolumeControlsProps) {
  const { soundtrackVolume, soundEffectsVolume, setSoundtrackVolume, setSoundEffectsVolume } = useSound();

  const soundtrackAccent = variant === "menu" ? "accent-[#ffaf09]" : "accent-[#ffd65c]";
  const sfxAccent = variant === "menu" ? "accent-[#75e2be]" : "accent-[#75e2be]";

  if (variant === "menu") {
    return (
      <section className="flex flex-col gap-3">
        <VolumeRow
          label="Soundtrack"
          value={soundtrackVolume}
          onChange={setSoundtrackVolume}
          ariaLabel="Soundtrack volume"
          variant="menu"
          accentClass={soundtrackAccent}
        />
        <VolumeRow
          label="Sound effects"
          value={soundEffectsVolume}
          onChange={setSoundEffectsVolume}
          ariaLabel="Sound effects volume"
          variant="menu"
          accentClass={sfxAccent}
        />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <VolumeRow
        label="Soundtrack volume"
        value={soundtrackVolume}
        onChange={setSoundtrackVolume}
        ariaLabel="Soundtrack volume"
        variant="page"
        accentClass={soundtrackAccent}
      />
      <VolumeRow
        label="Sound effects volume"
        value={soundEffectsVolume}
        onChange={setSoundEffectsVolume}
        ariaLabel="Sound effects volume"
        variant="page"
        accentClass={sfxAccent}
      />
    </div>
  );
}
