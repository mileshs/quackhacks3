import { Agentation } from "agentation";
import { NavLink, Route, Routes } from "react-router-dom";
import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { PoseTestPage } from "./pages/PoseTestPage";
import { SaboteurPage } from "./pages/SaboteurPage";
import { ScorePage } from "./pages/ScorePage";
import { SettingsPage } from "./pages/SettingsPage";
import { appShell, brand, navLink, navList, topbar } from "./lib/ui";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/game", label: "Game" },
  { to: "/pose-test", label: "Pose Test" },
  { to: "/saboteur", label: "Saboteur" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/settings", label: "Settings" }
];

export function App() {
  return (
    <>
      <div className={appShell}>
        <header className={topbar}>
          <NavLink className={brand} to="/">
            QuackHacks 3
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
            <Route path="/game" element={<GamePage />} />
            <Route path="/pose-test" element={<PoseTestPage />} />
            <Route path="/saboteur" element={<SaboteurPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/score" element={<ScorePage />} />
          </Routes>
        </main>
      </div>
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
