import { lazy, Suspense } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { PoseTestPage } from "./pages/PoseTestPage";
import { SaboteurPage } from "./pages/SaboteurPage";
import { ScorePage } from "./pages/ScorePage";
import { SettingsPage } from "./pages/SettingsPage";
import { appShell, brand, navLink, navList, topbar } from "./lib/ui";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/pose-test", label: "Pose Test" },
  { to: "/saboteur", label: "Saboteur" },
  { to: "/settings", label: "Settings" }
];

const DevAgentation = import.meta.env.DEV
  ? lazy(() => import("./DevAgentation").then((mod) => ({ default: mod.DevAgentation })))
  : null;

export function App() {
  return (
    <>
      <div className={appShell}>
        <header className={topbar}>
          <NavLink className={brand} to="/">
            Poses for Dummies
          </NavLink>
          <nav className={navList} aria-label="Primary">
            {navItems.map((item) => (
              <NavLink className={navLink} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pose-test" element={<PoseTestPage />} />
            <Route path="/saboteur" element={<SaboteurPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/score" element={<ScorePage />} />
          </Routes>
        </main>
      </div>
      {DevAgentation ? (
        <Suspense fallback={null}>
          <DevAgentation />
        </Suspense>
      ) : null}
    </>
  );
}
