import { APP_BUILD_VERSION, APP_BUILD_COMPATIBILITY_VERSION } from "../appBuild.js";
import { getNetworkConfigSummary } from "../multiplayer/config.js";

const STORAGE_KEY = "rd:diagnostics:v1";
const MAX_EVENTS = 50;

function safeText(value, max = 500) {
  if (value == null) return "";
  return String(value).replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, max);
}

export function normalizeDiagnosticError(error) {
  if (error instanceof Error) {
    return { name: safeText(error.name, 80), message: safeText(error.message), stack: safeText(error.stack, 2000) };
  }
  return { name: "Error", message: safeText(error) };
}

export function createDiagnosticEvent(type, details = {}, now = () => new Date()) {
  return {
    id: `${now().getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: safeText(type, 80),
    at: now().toISOString(),
    buildVersion: APP_BUILD_VERSION,
    compatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
    path: typeof location === "undefined" ? "" : safeText(location.pathname + location.search, 300),
    online: typeof navigator === "undefined" ? null : navigator.onLine,
    details: Object.fromEntries(Object.entries(details).map(([key, value]) => [safeText(key, 80), typeof value === "object" ? safeText(JSON.stringify(value)) : safeText(value)])),
  };
}

export function readDiagnosticEvents(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

export function recordDiagnostic(type, details = {}, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const event = createDiagnosticEvent(type, details, options.now);
  if (storage) {
    try {
      const events = [...readDiagnosticEvents(storage), event].slice(-MAX_EVENTS);
      storage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch { /* diagnostics must never break the game */ }
  }
  const endpoint = options.endpoint ?? import.meta.env?.VITE_DIAGNOSTICS_ENDPOINT;
  if (endpoint && typeof navigator !== "undefined" && navigator.sendBeacon) {
    try { navigator.sendBeacon(endpoint, new Blob([JSON.stringify(event)], { type: "application/json" })); } catch { /* optional */ }
  }
  return event;
}

export function createDiagnosticReport(storage = globalThis.localStorage) {
  return {
    generatedAt: new Date().toISOString(),
    buildVersion: APP_BUILD_VERSION,
    compatibilityVersion: APP_BUILD_COMPATIBILITY_VERSION,
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    network: getNetworkConfigSummary(),
    events: readDiagnosticEvents(storage),
  };
}

export function buildDiagnosticReport(storage = globalThis.localStorage) {
  return JSON.stringify(createDiagnosticReport(storage), null, 2);
}

export function installGlobalDiagnostics(target = globalThis) {
  if (!target?.addEventListener) return () => {};
  const onError = (event) => recordDiagnostic("window-error", normalizeDiagnosticError(event.error || event.message));
  const onRejection = (event) => recordDiagnostic("unhandled-rejection", normalizeDiagnosticError(event.reason));
  const onOffline = () => recordDiagnostic("network-offline");
  const onOnline = () => recordDiagnostic("network-online");
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("offline", onOffline);
  target.addEventListener("online", onOnline);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("offline", onOffline);
    target.removeEventListener("online", onOnline);
  };
}
