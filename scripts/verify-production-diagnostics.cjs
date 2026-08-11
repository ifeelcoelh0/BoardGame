const fs = require("fs");
function need(file, text) { const value = fs.readFileSync(file, "utf8"); if (!value.includes(text)) throw new Error(`${file}: falta ${text}`); }
need("src/main.jsx", "installGlobalDiagnostics(window)");
need("src/main.jsx", "GameErrorBoundary");
need("src/diagnostics/diagnostics.js", "unhandledrejection");
need("src/diagnostics/diagnostics.js", "VITE_DIAGNOSTICS_ENDPOINT");
need("src/diagnostics/diagnostics.js", "[redacted]");
need("src/ui/errors/GameErrorBoundary.jsx", "Copiar relatório técnico");
console.log("Diagnóstico de produção verificado.");
need("src/app/useRealmSession.js", "host-peer-error");
need("src/app/useRealmSession.js", "client-peer-error");
need("src/app/useRealmSession.js", "client-connection-close");
