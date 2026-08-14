import { createWizardProgress, normalizeWizardProgress } from "./wizardJourney.js";

export const WIZARD_STORAGE_KEY = "reinos_dragao_wizard_v1";

function browserStorage() {
  if (typeof window === "undefined") return null;
  try { return window.localStorage ?? null; } catch { return null; }
}

export function loadWizardProgress(storage = browserStorage()) {
  if (!storage?.getItem) return createWizardProgress();
  try {
    const raw = storage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return createWizardProgress();
    return normalizeWizardProgress(JSON.parse(raw));
  } catch {
    return createWizardProgress();
  }
}

export function saveWizardProgress(progress, storage = browserStorage()) {
  const normalized = normalizeWizardProgress(progress);
  if (!storage?.setItem) return normalized;
  try { storage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

export function clearWizardProgress(storage = browserStorage()) {
  try { storage?.removeItem?.(WIZARD_STORAGE_KEY); } catch {}
  return createWizardProgress();
}
