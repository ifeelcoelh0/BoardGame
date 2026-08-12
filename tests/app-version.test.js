import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { APP_VERSION } from "../src/appVersion.js";
import { APP_BUILD_COMPATIBILITY_VERSION, APP_BUILD_VERSION } from "../src/appBuild.js";
import { APP_VERSION as SAVE_APP_VERSION } from "../src/game/saveSchema.js";

test("runtime, diagnostics, saves and package metadata share one application version", async () => {
  const packageMetadata = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(APP_BUILD_VERSION, APP_VERSION);
  assert.equal(APP_BUILD_COMPATIBILITY_VERSION, 3);
  assert.equal(SAVE_APP_VERSION, APP_VERSION);
  assert.equal(packageMetadata.version, APP_VERSION);
  assert.equal(packageLock.version, APP_VERSION);
  assert.equal(packageLock.packages[""].version, APP_VERSION);
});
