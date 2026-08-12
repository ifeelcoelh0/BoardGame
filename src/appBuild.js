import { APP_VERSION } from "./appVersion.js";

export const APP_BUILD_VERSION = APP_VERSION;
export const APP_BUILD_COMPATIBILITY_VERSION = 3;

export function isCompatibleBuild(remoteCompatibilityVersion) {
  return remoteCompatibilityVersion === APP_BUILD_COMPATIBILITY_VERSION;
}
