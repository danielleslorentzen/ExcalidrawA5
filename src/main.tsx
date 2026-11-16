import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@excalidraw/excalidraw/index.css";
import "./styles.css";
import App from "./App";

// Serve Excalidraw's fonts from this app (copied into public/fonts) so it works offline.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = import.meta.env.BASE_URL;

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
