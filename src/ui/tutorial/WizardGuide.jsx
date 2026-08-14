import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../../assets/assetUrl.js";
import {
  WIZARD_SCOPE,
  WIZARD_STATUS,
  WIZARD_STEP,
  WIZARD_TRAINING_MODES,
  answerGameTutorialOffer,
  beginWizardTour,
  chooseTrainingMode,
  completeWizardStep,
  currentWizardStep,
  resetWizardProgress,
  restartWizardScope,
  resumeWizardTour,
  skipWizardTour,
} from "../../tutorial/wizardJourney.js";
import { loadWizardProgress, saveWizardProgress } from "../../tutorial/wizardStorage.js";
import { t } from "../../locales/i18n.js";
import { GameButton, GameSurface } from "../system/index.js";
import { WIZARD_INTERACTION, WIZARD_STEP_CATALOG } from "./wizardStepCatalog.js";
import "../../styles/wizard-guide.css";

const WIZARD_IMAGE = assetUrl("assets/tutorial/wizard-guide.png");

/*
 * O Códice anima as folhas com transforms. ResizeObserver/MutationObserver não
 * recebem eventos por cada frame dessa animação, por isso a medição antiga
 * podia congelar coordenadas a meio da viragem. Seguimos o alvo durante a
 * janela de transição e depois ficamos só com observers/scroll/resize.
 */
function useTargetRect(selector, active, padding = 9) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || !selector || typeof document === "undefined") {
      setRect(null);
      return undefined;
    }

    let frame = null;
    let followStart = performance.now();
    const measure = () => {
      const element = document.querySelector(selector);
      if (!element) {
        setRect(null);
        return;
      }
      const next = element.getBoundingClientRect();
      if (next.width <= 0 || next.height <= 0) {
        setRect(null);
        return;
      }
      const left = Math.max(6, next.left - padding);
      const top = Math.max(6, next.top - padding);
      const right = Math.min(window.innerWidth - 6, next.right + padding);
      const bottom = Math.min(window.innerHeight - 6, next.bottom + padding);
      const measured = {
        left: Math.round(left),
        top: Math.round(top),
        width: Math.max(1, Math.round(right - left)),
        height: Math.max(1, Math.round(bottom - top)),
      };
      setRect((current) => (
        current
        && current.left === measured.left
        && current.top === measured.top
        && current.width === measured.width
        && current.height === measured.height
          ? current
          : measured
      ));
    };

    const followTransition = () => {
      measure();
      if (performance.now() - followStart < 920) frame = requestAnimationFrame(followTransition);
      else frame = null;
    };

    const restartFollow = () => {
      followStart = performance.now();
      if (frame === null) frame = requestAnimationFrame(followTransition);
    };

    restartFollow();
    const observer = new MutationObserver(restartFollow);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(restartFollow) : null;
    const element = document.querySelector(selector);
    if (element) resizeObserver?.observe(element);
    window.addEventListener("resize", restartFollow);
    window.addEventListener("scroll", restartFollow, true);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", restartFollow);
      window.removeEventListener("scroll", restartFollow, true);
    };
  }, [selector, active, padding]);

  return rect;
}

function useSelectorMatch(selector, active) {
  const [matched, setMatched] = useState(false);
  useEffect(() => {
    if (!active || !selector || typeof document === "undefined") {
      setMatched(false);
      return undefined;
    }
    const check = () => setMatched(Boolean(document.querySelector(selector)));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selector, active]);
  return matched;
}

function useTargetActivation(selector, active, onActivate) {
  const callbackRef = useRef(onActivate);
  callbackRef.current = onActivate;
  useEffect(() => {
    if (!active || !selector || typeof document === "undefined") return undefined;
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest(selector) : null;
      if (target) callbackRef.current?.();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [selector, active]);
}

function WizardSpotlight({ rect }) {
  if (!rect || typeof window === "undefined") return null;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const radius = Math.max(7, Math.min(14, rect.height * 0.16));
  return (
    <svg
      className="rd-wizard__spotlight-layer"
      aria-hidden="true"
      viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="rd-wizard-spotlight-soften" x="-12%" y="-28%" width="124%" height="156%">
          <feGaussianBlur stdDeviation="4.2" />
        </filter>
        <filter id="rd-wizard-spotlight-rim" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3.4" />
        </filter>
        <mask id="rd-wizard-spotlight-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={viewportWidth} height={viewportHeight}>
          <rect x="0" y="0" width={viewportWidth} height={viewportHeight} fill="white" />
          <rect
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx={radius}
            fill="black"
            filter="url(#rd-wizard-spotlight-soften)"
          />
        </mask>
      </defs>
      <rect
        className="rd-wizard__spotlight-dim"
        x="0"
        y="0"
        width={viewportWidth}
        height={viewportHeight}
        mask="url(#rd-wizard-spotlight-mask)"
      />
      <rect
        className="rd-wizard__spotlight-rim"
        x={rect.left + 1}
        y={rect.top + 1}
        width={Math.max(1, rect.width - 2)}
        height={Math.max(1, rect.height - 2)}
        rx={radius}
        filter="url(#rd-wizard-spotlight-rim)"
      />
    </svg>
  );
}

function trainingModeLabel(mode) {
  if (mode === "classico") return t("mode.classico.name");
  if (mode === "rapido") return t("mode.rapido.name");
  return t("mode.dragao.name");
}

function TrainingModeChoices({ onChoose }) {
  const descriptions = {
    classico: t("wizard.trainingClassic"),
    rapido: t("wizard.trainingRapid"),
    dragao: t("wizard.trainingDragon"),
  };
  return (
    <div className="rd-wizard__mode-grid">
      {WIZARD_TRAINING_MODES.map((mode) => (
        <button key={mode} type="button" onClick={() => onChoose(mode)}>
          <small>{t("wizard.recommended")}</small>
          <strong>{trainingModeLabel(mode)}</strong>
          <span>{descriptions[mode]}</span>
        </button>
      ))}
    </div>
  );
}

function WizardPortrait({ mirrored = false }) {
  return (
    <div className={`rd-wizard__portrait${mirrored ? " is-mirrored" : ""}`} aria-hidden="true">
      <img src={WIZARD_IMAGE} width="148" height="148" alt="" />
    </div>
  );
}

function WizardPanel({ title, body, position, mirrored, children, onClose, onSkip }) {
  return (
    <div className={`rd-wizard__dock is-${position}`}>
      <WizardPortrait mirrored={mirrored} />
      <GameSurface
        material="parchment-raised"
        emphasis="ceremonial"
        className="rd-wizard__parchment"
        role="dialog"
        aria-modal="false"
        aria-label={title}
        data-testid="wizard-guide"
      >
        <header className="rd-wizard__head">
          <small>{t("wizard.guide")}</small>
          <strong>{title}</strong>
          {onClose && <button type="button" onClick={onClose} aria-label={t("wizard.closeHelp")}>×</button>}
        </header>
        <p className="rd-wizard__copy">{body}</p>
        {children}
        {onSkip && <button className="rd-wizard__skip" type="button" onClick={onSkip}>{t("wizard.skipTour")}</button>}
      </GameSurface>
    </div>
  );
}

function WizardOrb({ onClick }) {
  return (
    <button className="rd-wizard-orb" data-testid="wizard-orb" type="button" onClick={onClick} aria-label={t("wizard.callWizard")} title={t("wizard.callWizard")}>
      <span className="rd-wizard-orb__core" aria-hidden="true" />
      <span className="rd-wizard-orb__spark is-one" aria-hidden="true">✦</span>
      <span className="rd-wizard-orb__spark is-two" aria-hidden="true">·</span>
    </button>
  );
}

function completionSatisfied(step, context, selectorMatched) {
  const completion = step?.completion;
  if (!completion) return false;
  if (completion.type === "scope") return context.scope === completion.value;
  if (completion.type === "book-page") return context.bookPage === completion.value;
  if (completion.type === "selector") return selectorMatched;
  if (completion.type === "character-preview") return context.isSelectingCharacter && Boolean(context.previewCharacterId);
  if (completion.type === "character-confirmed") return context.hasConfirmedCharacter && !context.isSelectingCharacter;
  return false;
}

export default function WizardGuide({
  scope = WIZARD_SCOPE.FOYER,
  bookPage = null,
  bookOpen = false,
  onShowBookPage = null,
  disabled = false,
  isSelectingCharacter = false,
  previewCharacterId = null,
  hasConfirmedCharacter = false,
}) {
  const [progress, setProgress] = useState(() => loadWizardProgress());
  const [helpOpen, setHelpOpen] = useState(false);
  const [snoozedStep, setSnoozedStep] = useState(null);
  const [confirmedMode, setConfirmedMode] = useState(null);
  const preparedStepRef = useRef(null);
  const activeStepId = currentWizardStep(progress, { scope });
  const step = activeStepId ? WIZARD_STEP_CATALOG[activeStepId] ?? null : null;
  const stepVisible = Boolean(step && !disabled && snoozedStep !== activeStepId && !helpOpen && !confirmedMode);
  const targetRect = useTargetRect(step?.target, stepVisible, step?.padding ?? 9);
  const selectorMatched = useSelectorMatch(step?.completion?.type === "selector" ? step.completion.value : null, stepVisible);
  const context = { scope, bookPage, bookOpen, isSelectingCharacter, previewCharacterId, hasConfirmedCharacter };
  const completedByAction = completionSatisfied(step, context, selectorMatched);
  const targetClickSelector = step?.completion?.type === "target-click" ? step.completion.value : null;

  const persist = (next) => {
    const saved = saveWizardProgress(next);
    setProgress(saved);
    return saved;
  };

  const completeStep = (stepId) => {
    if (!stepId) return;
    setProgress((current) => saveWizardProgress(completeWizardStep(current, stepId)));
    setSnoozedStep(null);
  };

  useTargetActivation(targetClickSelector, stepVisible, () => completeStep(activeStepId));

  useEffect(() => {
    setSnoozedStep(null);
    setHelpOpen(false);
    setConfirmedMode(null);
  }, [scope]);

  useEffect(() => {
    if (!stepVisible) preparedStepRef.current = null;
  }, [stepVisible]);

  useEffect(() => {
    if (!stepVisible || !step?.page || preparedStepRef.current === activeStepId || completedByAction) return;
    preparedStepRef.current = activeStepId;
    if (!bookOpen || bookPage !== step.page) onShowBookPage?.(step.page);
  }, [activeStepId, stepVisible, step?.page, bookOpen, bookPage, onShowBookPage, completedByAction]);

  useEffect(() => {
    if (!activeStepId || step?.interaction !== WIZARD_INTERACTION.ACTION || !completedByAction) return;
    completeStep(activeStepId);
  }, [activeStepId, completedByAction, step?.interaction]);

  // Recovery de contexto: se o browser/sessão regressa num estado mais à
  // frente do que o último evento persistido do mago, damos uma pequena janela
  // ao recovery normal da app e depois alinhamos o tutorial com a realidade.
  // Isto não corre depois de "Saltar visita"; nesse caso só o orbe retoma.
  useEffect(() => {
    if (disabled || helpOpen || confirmedMode || activeStepId || progress.status !== WIZARD_STATUS.GUIDED) return undefined;
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const recovered = resumeWizardTour(current, context);
        if (JSON.stringify(recovered) === JSON.stringify(current)) return current;
        return saveWizardProgress(recovered);
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    activeStepId,
    confirmedMode,
    disabled,
    hasConfirmedCharacter,
    helpOpen,
    isSelectingCharacter,
    previewCharacterId,
    progress.status,
    scope,
  ]);

  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
  const dockPosition = step?.position ?? (targetRect && targetRect.top > viewportHeight * 0.6 ? "top" : "bottom");
  const mirrored = Boolean(targetRect && targetRect.left > viewportWidth * 0.58);
  const title = step ? t(step.titleKey) : "";
  const body = step ? t(step.bodyKey) : "";

  const completeCurrent = () => completeStep(activeStepId);
  const closeCurrent = () => activeStepId && setSnoozedStep(activeStepId);
  const resumeTour = () => {
    persist(resumeWizardTour(progress, context));
    setHelpOpen(false);
    setSnoozedStep(null);
  };
  const restartHere = () => {
    let next = restartWizardScope(progress, scope);
    // Repetir o capítulo do Reino depois de uma Casa já confirmada não deve
    // prender o jogador numa parede que já terminou. Nesse estado recomeçamos
    // pela explicação de Ready/Start Match.
    if (scope === WIZARD_SCOPE.REALM && hasConfirmedCharacter && !isSelectingCharacter) {
      next = completeWizardStep(next, WIZARD_STEP.REALM_SELECT_CHARACTER);
      next = completeWizardStep(next, WIZARD_STEP.REALM_SIGN_CHARACTER);
    }
    persist(next);
    setHelpOpen(false);
    setSnoozedStep(null);
  };
  const restartAll = () => {
    persist(resetWizardProgress());
    setHelpOpen(false);
    setSnoozedStep(null);
  };

  const helpBody = scope === WIZARD_SCOPE.REALM ? t("wizard.helpRealmBody") : t("wizard.helpFoyerBody");
  const preferredModeLabel = progress.preferredTrainingMode ? trainingModeLabel(progress.preferredTrainingMode) : null;
  const isChoiceStep = [WIZARD_STEP.WELCOME, WIZARD_STEP.GAME_TUTORIAL_OFFER, WIZARD_STEP.GAME_TUTORIAL_MODE].includes(activeStepId);

  return (
    <>
      {stepVisible && step?.target && targetRect && <WizardSpotlight rect={targetRect} />}

      {stepVisible && activeStepId === WIZARD_STEP.WELCOME && (
        <WizardPanel title={title} body={body} position="bottom" mirrored={false}>
          <div className="rd-wizard__actions">
            <GameButton variant="quiet" size="sm" onClick={() => persist(skipWizardTour(progress))}>{t("wizard.alreadyKnow")}</GameButton>
            <GameButton variant="primary" size="sm" onClick={() => persist(beginWizardTour(progress))}>{t("wizard.showMe")}</GameButton>
          </div>
        </WizardPanel>
      )}

      {stepVisible && activeStepId && !isChoiceStep && (
        <WizardPanel title={title} body={body} position={dockPosition} mirrored={mirrored} onClose={closeCurrent} onSkip={() => persist(skipWizardTour(progress))}>
          {step.interaction === WIZARD_INTERACTION.ACTION ? (
            <p className="rd-wizard__objective"><span aria-hidden="true">◆</span>{t("wizard.performAction")}</p>
          ) : (
            <div className="rd-wizard__actions">
              <GameButton variant="primary" size="sm" onClick={completeCurrent}>{t("wizard.next")}</GameButton>
            </div>
          )}
        </WizardPanel>
      )}

      {stepVisible && activeStepId === WIZARD_STEP.GAME_TUTORIAL_OFFER && (
        <WizardPanel title={title} body={body} position="bottom" mirrored={false} onClose={closeCurrent}>
          <div className="rd-wizard__actions">
            <GameButton variant="quiet" size="sm" onClick={() => persist(answerGameTutorialOffer(progress, false))}>{t("wizard.notNow")}</GameButton>
            <GameButton variant="primary" size="sm" onClick={() => persist(answerGameTutorialOffer(progress, true))}>{t("wizard.wantTutorial")}</GameButton>
          </div>
        </WizardPanel>
      )}

      {stepVisible && activeStepId === WIZARD_STEP.GAME_TUTORIAL_MODE && (
        <WizardPanel title={title} body={body} position="bottom" mirrored={false} onClose={closeCurrent}>
          <TrainingModeChoices onChoose={(mode) => {
            persist(chooseTrainingMode(progress, mode));
            setConfirmedMode(mode);
          }} />
        </WizardPanel>
      )}

      {confirmedMode && (
        <WizardPanel title={t("wizard.trainingSavedTitle")} body={t("wizard.trainingSavedBody", { mode: trainingModeLabel(confirmedMode) })} position="bottom" mirrored={false}>
          <div className="rd-wizard__actions">
            <GameButton variant="primary" size="sm" onClick={() => setConfirmedMode(null)}>{t("wizard.gotIt")}</GameButton>
          </div>
        </WizardPanel>
      )}

      {helpOpen && !disabled && (
        <WizardPanel title={t("wizard.helpTitle")} body={helpBody} position="bottom" mirrored={false} onClose={() => setHelpOpen(false)}>
          <div className="rd-wizard__help-actions">
            {activeStepId && snoozedStep === activeStepId ? (
              <GameButton variant="primary" size="sm" onClick={resumeTour}>{t("wizard.resumeTour")}</GameButton>
            ) : (progress.status === WIZARD_STATUS.SKIPPED || progress.status === WIZARD_STATUS.NEW || (progress.status === WIZARD_STATUS.GUIDED && !activeStepId)) ? (
              <GameButton variant="primary" size="sm" onClick={resumeTour}>{progress.status === WIZARD_STATUS.NEW || (progress.status === WIZARD_STATUS.SKIPPED && progress.completedSteps.length === 0) ? t("wizard.startTour") : t("wizard.resumeTour")}</GameButton>
            ) : null}
            <GameButton variant="secondary" size="sm" onClick={restartHere}>{t("wizard.repeatHere")}</GameButton>
            {scope === WIZARD_SCOPE.FOYER && <GameButton variant="quiet" size="sm" onClick={restartAll}>{t("wizard.restartAll")}</GameButton>}
            {preferredModeLabel && <p className="rd-wizard__preference">{t("wizard.trainingPreference", { mode: preferredModeLabel })}</p>}
          </div>
        </WizardPanel>
      )}

      {!disabled && !stepVisible && !helpOpen && !confirmedMode && <WizardOrb onClick={() => setHelpOpen(true)} />}
    </>
  );
}
