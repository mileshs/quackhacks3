import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { SoundProvider } from "./providers/SoundProvider";
import { SettingsProvider } from "./lib/settings";
import "./tailwind.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <SoundProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </SoundProvider>
    </BrowserRouter>
  </StrictMode>
);
