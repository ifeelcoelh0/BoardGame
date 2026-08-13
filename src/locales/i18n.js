import EN from "./en.js";
import PT_PT from "./pt-PT.js";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = Object.freeze(["en", "pt-PT"]);
const STORAGE_KEY = "reinos_dragao_locale_v1";
const CATALOGS = Object.freeze({ en: EN, "pt-PT": PT_PT });

function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "pt" || raw === "pt-pt" || raw === "pt_pt") return "pt-PT";
  return "en";
}

function browserInitialLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const query = new URLSearchParams(window.location.search).get("lang");
    if (query) return normalizeLocale(query);
    const stored = window.localStorage?.getItem?.(STORAGE_KEY);
    if (stored) return normalizeLocale(stored);
  } catch {}
  return DEFAULT_LOCALE;
}

let activeLocale = browserInitialLocale();

function humanizeKey(key) {
  const tail = String(key || "").split(".").pop() || "";
  if (!tail) return "";
  const words = tail
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!words) return String(key || "");
  const titled = words.charAt(0).toUpperCase() + words.slice(1);
  return titled
    .replace(/\bVp\b/g, "VP")
    .replace(/\bUi\b/g, "UI")
    .replace(/\bSr\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function interpolate(template, params) {
  if (!params || typeof params !== "object") return String(template ?? "");
  return String(template ?? "").replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

function syncDocumentLanguage() {
  if (typeof document !== "undefined" && document.documentElement) document.documentElement.lang = activeLocale;
}

export function getLocale() {
  return activeLocale;
}

export function setLocale(locale, { persist = true } = {}) {
  activeLocale = normalizeLocale(locale);
  if (persist && typeof window !== "undefined") {
    try { window.localStorage?.setItem?.(STORAGE_KEY, activeLocale); } catch {}
  }
  syncDocumentLanguage();
  return activeLocale;
}

export function t(key, params = undefined, locale = activeLocale) {
  const normalized = normalizeLocale(locale);
  const catalog = CATALOGS[normalized] || EN;
  const fallback = EN[key];
  const value = catalog[key] ?? fallback ?? humanizeKey(key);
  return interpolate(value, params);
}

export function hasTranslation(key, locale = activeLocale) {
  const normalized = normalizeLocale(locale);
  return Object.prototype.hasOwnProperty.call(CATALOGS[normalized] || EN, key)
    || Object.prototype.hasOwnProperty.call(EN, key);
}

export function localeCatalog(locale = activeLocale) {
  return CATALOGS[normalizeLocale(locale)] || EN;
}

syncDocumentLanguage();
