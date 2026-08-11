const fs = require("fs");
function need(file, text) {
  const value = fs.readFileSync(file, "utf8");
  if (!value.includes(text)) throw new Error(`${file}: falta ${text}`);
}
function forbid(file, text) {
  const value = fs.readFileSync(file, "utf8");
  if (value.includes(text)) throw new Error(`${file}: ainda contém ${text}`);
}

need("src/loading/modulePreload.js", "requestIdleCallback");
need("src/loading/modulePreload.js", "preloadBoardModule");
need("src/app/App.jsx", "scheduleModulePreload(preloadBoardModule)");
need("src/ui/game/GameScreen.jsx", "lazy(preloadBoardModule)");
need("src/ui/lobby/pages/RealmPages.jsx", "APP_BUILD_VERSION");
need("src/ui/lobby/pages/RealmPages.jsx", 'data-testid="diagnostics-version"');

/* Ferramentas internas pertencem a um grafo DEV que o Rollup pode eliminar. */
need("src/main.jsx", "import.meta.env.DEV");
need("src/main.jsx", "DevelopmentTools");
forbid("src/main.jsx", 'lazy(() => import("./ui/assets/AssetGallery.jsx"))');
forbid("src/main.jsx", 'lazy(() => import("./ui/lab/UILab.jsx"))');
forbid("vite.config.js", 'return "internal-tools"');

need("vite.config.js", "sourcemap: false");
need("vite.config.js", "__APP_VERSION__");
need("index.html", "__APP_VERSION__");

need("vercel.json", "no-cache, no-store, must-revalidate");
need("vercel.json", "stale-while-revalidate");
need("vercel.json", "X-Content-Type-Options");
need("vercel.json", "Content-Security-Policy");
need("vercel.json", "/((?!assets/).*)");
console.log("Carregamento e configuração de deploy verificados.");
