import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["playwright", "test", "tests/e2e/network-smoke.spec.js"], {
  stdio: "inherit",
  env: { ...process.env, RUN_REAL_PEERJS: "1" },
});
child.on("exit", (code) => process.exit(code ?? 1));
