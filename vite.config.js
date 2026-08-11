import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { APP_VERSION } from "./src/appVersion.js";

function appVersionHtmlPlugin() {
  return {
    name: "reinos-app-version-html",
    transformIndexHtml(html) {
      return html.replaceAll("__APP_VERSION__", APP_VERSION);
    },
  };
}

export default defineConfig({
  plugins: [react(), appVersionHtmlPlugin()],
  server: {
    host: true,
  },
  build: {
    /* Sem um serviço de error tracking que receba mapas privados, publicar
       sourcemaps só aumenta o artefacto. Quando esse serviço existir, a política
       deve ser upload + remoção do dist, não exposição pública. */
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/peerjs")) return "multiplayer";
          if (id.includes("node_modules/react")) return "react-vendor";
          if (id.includes("/src/ui/lobby/")) return "lobby";
          if (id.includes("/src/ui/board/")) return "board";
          return undefined;
        },
      },
    },
  },
});
