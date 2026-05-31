import { lazy, Suspense, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { HomePage } from "./pages/HomePage";
import { FinalScreenPage } from "./pages/FinalScreenPage";
import { PoseTestPage } from "./pages/PoseTestPage";
import { SaboteurPage } from "./pages/SaboteurPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ChromeContext } from "./lib/chrome";
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
  const [navHidden, setNavHidden] = useState(false);

  return (
    <ChromeContext.Provider value={{ navHidden, setNavHidden }}>
      <div className={appShell}>
        {navHidden ? null : (
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
        )}
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pose-test" element={<PoseTestPage />} />
            <Route path="/saboteur" element={<SaboteurPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/score" element={<FinalScreenPage />} />
          </Routes>
        </main>
      </div>
      {DevAgentation ? (
        <Suspense fallback={null}>
          <DevAgentation />
        </Suspense>
      ) : null}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast:
              "font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif] rounded-2xl border-0! bg-white/82! px-5! py-3! text-center text-base! leading-tight font-black! text-[#8c3d18]! shadow-[inset_0_2px_0_rgba(255,255,255,0.72),0_14px_36px_rgba(143,101,11,0.22)]! backdrop-blur-md",
            title: "text-center font-black!",
            closeButton: "bg-white! text-[#8c3d18]!"
          }
        }}
      />
    </ChromeContext.Provider>
  );
}
