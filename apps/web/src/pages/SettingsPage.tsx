import { useEffect, useState } from "react";

const volumeStorageKey = "quackhacks.volume";

export function SettingsPage() {
  const [volume, setVolume] = useState(70);

  useEffect(() => {
    const savedVolume = window.localStorage.getItem(volumeStorageKey);

    if (savedVolume) {
      setVolume(Number(savedVolume));
    }
  }, []);

  function updateVolume(nextVolume: number) {
    setVolume(nextVolume);
    window.localStorage.setItem(volumeStorageKey, String(nextVolume));
  }

  return (
    <section className="page-grid settings-page">
      <div className="page-heading">
        <p className="eyebrow">Settings</p>
        <h1>Audio</h1>
      </div>
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
    </section>
  );
}
