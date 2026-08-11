import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./styles/game-ui-system.css";
import "./styles/app.css";
import GameErrorBoundary from "./ui/errors/GameErrorBoundary.jsx";
import { installGlobalDiagnostics, recordDiagnostic } from "./diagnostics/diagnostics.js";

const App = lazy(() => import("./app/App.jsx"));
const DevelopmentTools = import.meta.env.DEV
  ? lazy(() => import("./ui/dev/DevelopmentTools.jsx"))
  : null;

installGlobalDiagnostics(window);
recordDiagnostic("app-start");

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Não foi encontrado o elemento #root.");
}

rootElement.removeAttribute("style");

const searchParams = new URLSearchParams(window.location.search);
const devPage = searchParams.get("dev");

function LoadingScreen() {
  return <div className="rd" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>A carregar…</div>;
}

function ApplicationEntry() {
  if (import.meta.env.DEV && DevelopmentTools && (devPage === "assets" || devPage === "ui")) {
    return <DevelopmentTools page={devPage} />;
  }
  return <App />;
}

createRoot(rootElement).render(
  <StrictMode>
    <GameErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      <ApplicationEntry />
    </Suspense>
    </GameErrorBoundary>
  </StrictMode>,
);
