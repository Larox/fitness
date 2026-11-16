import type { AppConfig } from "../config/types";
import {
  arraysEqualSorted,
  selectHomeBell,
  selectNoHomeBells,
  summarizeBellRange,
} from "./bells";
import { summarizeSettingsChange } from "./changes";
import {
  acknowledgeDisclaimer,
  formatAcknowledgedDate,
  needsDisclaimerAcknowledgement,
} from "./disclaimer";
import { createConditionLabelContext } from "./condition-labels";
import {
  mountConditionEditScreen,
  notesPreview,
} from "./condition-edit-screen";
import { pruneConditionOverrides } from "./condition-overrides";
import { escapeHtml, ICONS } from "./icons";
import { applyTrainingSettingsSave } from "../plan/apply-settings-save";
import type { PlanBuildContext } from "../plan/apply-settings-save";
import { renderThisWeekList } from "../plan/render-week";
import { mergePersistedState } from "./merge";
import type { SettingsStorage } from "./storage";
import {
  clampDaysPerWeek,
  daysPerWeekHint,
  DAYS_PER_WEEK_MAX,
  DAYS_PER_WEEK_MIN,
  SESSION_LENGTH_OPTIONS,
} from "./schedule";
import type { PersistedAppState, TrainingSettings } from "./types";

type SheetMode = "blocking" | "readonly" | null;

interface ScreenState {
  mode: "setup" | "settings";
  draft: TrainingSettings;
  saved: TrainingSettings;
  sheet: SheetMode;
  editingConditionId: string | null;
  conditionSavedBanner: { id: string; name: string } | null;
}

export interface MountSetupScreenOptions {
  config: AppConfig;
  storage: SettingsStorage;
  root: HTMLElement;
  /** Called after a successful save (start training or settings save). */
  onSaved?: (state: PersistedAppState, summary: ReturnType<typeof summarizeSettingsChange>) => void;
  myExerciseCount?: number;
  hurtExerciseCount?: number;
  onOpenMyExercises?: () => void;
  onOpenHurtList?: () => void;
  getPlanContext?: () => PlanBuildContext;
}

function cloneSettings(settings: TrainingSettings): TrainingSettings {
  return structuredClone(settings);
}

function dayOptions(): number[] {
  const days: number[] = [];
  for (let d = DAYS_PER_WEEK_MIN; d <= DAYS_PER_WEEK_MAX; d++) {
    days.push(d);
  }
  return days;
}

function settingsEqual(a: TrainingSettings, b: TrainingSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function changedDot(show: boolean): string {
  return show ? '<span class="changed" aria-label="changed"></span>' : "";
}

function renderSegmented(
  name: string,
  options: readonly number[],
  current: number,
  unit?: string,
): string {
  const unitHtml = unit ? `<small>${unit}</small>` : "";
  const buttons = options
    .map(
      (value) =>
        `<button type="button" role="radio" aria-checked="${value === current}" data-act="${name}" data-v="${value}">${value}${unitHtml}</button>`,
    )
    .join("");
  return `<div class="seg" role="radiogroup" aria-label="${name}">${buttons}</div>`;
}

function renderBellChips(
  where: "home" | "gym",
  selected: readonly number[],
  available: readonly number[],
  extra = "",
): string {
  const chips = available
    .map(
      (kg) =>
        `<button type="button" class="chip" aria-pressed="${selected.includes(kg)}" data-act="${where}" data-v="${kg}">${ICONS.ck}${kg} kg</button>`,
    )
    .join("");
  return `<div class="chips" role="group" aria-label="${where} bells">${extra}${chips}</div>`;
}

export function mountSetupScreen(options: MountSetupScreenOptions): {
  getState: () => PersistedAppState;
  destroy: () => void;
} {
  const {
    config,
    storage,
    root,
    onSaved,
    myExerciseCount = 0,
    hurtExerciseCount = 0,
    onOpenMyExercises,
    onOpenHurtList,
    getPlanContext,
  } = options;

  let persisted = mergePersistedState(storage.load(), config);
  const saved = cloneSettings(persisted.settings);
  const screen: ScreenState = {
    mode: persisted.setupComplete ? "settings" : "setup",
    draft: cloneSettings(persisted.settings),
    saved,
    sheet: needsDisclaimerAcknowledgement(persisted, config) ? "blocking" : null,
    editingConditionId: null,
    conditionSavedBanner: null,
  };

  let conditionEdit: ReturnType<typeof mountConditionEditScreen> | null = null;

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.id = "setup-bar";
  const layer = document.createElement("div");
  layer.id = "setup-layer";

  document.body.appendChild(bar);
  document.body.appendChild(layer);

  let refocusDisclaimerRow = false;

  function focusRestoreKey(element: HTMLElement): string | null {
    const interactive = element.closest<HTMLElement>("[data-act]");
    if (interactive?.dataset.act) {
      const act = interactive.dataset.act;
      const value = interactive.dataset.v;
      return value !== undefined ? `${act}:${value}` : act;
    }
    return element.id ? `#${element.id}` : null;
  }

  function captureFocus(): string | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      return null;
    }
    if (!root.contains(active) && !bar.contains(active) && !layer.contains(active)) {
      return null;
    }
    return focusRestoreKey(active);
  }

  function restoreFocus(key: string | null): void {
    if (refocusDisclaimerRow) {
      refocusDisclaimerRow = false;
      root.querySelector<HTMLElement>('[data-act="open-disclaimer"]')?.focus();
      return;
    }
    if (!key) {
      return;
    }
    if (key.startsWith("#")) {
      document.getElementById(key.slice(1))?.focus();
      return;
    }
    const colon = key.indexOf(":");
    const act = colon === -1 ? key : key.slice(0, colon);
    const value = colon === -1 ? undefined : key.slice(colon + 1);
    const selector =
      value !== undefined
        ? `[data-act="${act}"][data-v="${CSS.escape(value)}"]`
        : `[data-act="${act}"]`;
    const scope =
      act === "save" ? bar : act === "ack-disclaimer" || act === "close-disclaimer" ? layer : root;
    scope.querySelector<HTMLElement>(selector)?.focus();
  }

  function withPrunedOverrides(state: PersistedAppState): PersistedAppState {
    const pruned = pruneConditionOverrides(state.conditionOverrides ?? {}, config);
    return {
      ...state,
      conditionOverrides: Object.keys(pruned).length > 0 ? pruned : undefined,
    };
  }

  function persist(next: PersistedAppState): void {
    persisted = withPrunedOverrides(next);
    storage.save(persisted);
  }

  function applyImmediateSettings(draft: TrainingSettings): void {
    const previous = cloneSettings(screen.saved);
    const summary = summarizeSettingsChange(previous, draft);
    screen.draft = cloneSettings(draft);
    screen.saved = cloneSettings(draft);
    let next: PersistedAppState = { ...persisted, settings: draft };
    if (getPlanContext) {
      next = applyTrainingSettingsSave(next, draft, summary, getPlanContext());
    }
    persist(next);
  }

  function destroyConditionEdit(): void {
    conditionEdit?.destroy();
    conditionEdit = null;
    screen.editingConditionId = null;
  }

  function openConditionEdit(conditionId: string): void {
    destroyConditionEdit();
    screen.editingConditionId = conditionId;
    screen.conditionSavedBanner = null;
    conditionEdit = mountConditionEditScreen({
      config,
      conditionId,
      root,
      bar,
      layer,
      getPersisted: () => persisted,
      persistState: persist,
      finalizeSave: (next) => {
        const draft = next.settings;
        const summary = summarizeSettingsChange(screen.saved, draft);
        screen.draft = cloneSettings(draft);
        screen.saved = cloneSettings(draft);
        let merged = next;
        if (getPlanContext) {
          merged = applyTrainingSettingsSave(next, draft, summary, getPlanContext());
        }
        persist(merged);
      },
      onBack: (focusId) => {
        destroyConditionEdit();
        render();
        root.querySelector<HTMLElement>(`[data-act="cond-edit"][data-v="${CSS.escape(focusId)}"]`)?.focus();
      },
      onSaved: (id, name) => {
        destroyConditionEdit();
        screen.conditionSavedBanner = { id, name };
        render();
        root.querySelector<HTMLElement>("#condition-saved-row")?.focus();
      },
    });
  }

  function render(): void {
    if (screen.editingConditionId) {
      return;
    }
    const focusKey = captureFocus();
    const ackLabel = formatAcknowledgedDate(persisted.disclaimerAckAt);
    const isSetupMode = screen.mode === "setup";
    const gymDefault = arraysEqualSorted(
      screen.draft.gymBellsKg,
      config.equipment.gym.bellsKg,
    );
    const changeSummary = summarizeSettingsChange(screen.saved, screen.draft);
    const enabledCount = config.conditions.filter(
      (c) => screen.draft.conditionsEnabled[c.id],
    ).length;
    const conditionLabels = createConditionLabelContext(
      config,
      persisted.conditionOverrides ?? {},
    );

    let html = `<header class="hdr"><p class="overline">${isSetupMode ? "Setup" : "Settings"}</p>
      <h1 class="title">${isSetupMode ? "Plan your training" : "Training settings"}</h1>
      <p class="sub">${isSetupMode ? "Pick what fits. You can change any of this later in Settings." : "Changes apply from your next plan."}</p></header>`;

    if (!isSetupMode && screen.conditionSavedBanner) {
      html += `<div class="undorow" role="status" id="condition-saved-row" tabindex="-1"><p><b>Saved “${escapeHtml(screen.conditionSavedBanner.name)}”</b> Saved on this phone only.</p></div>`;
    }

    if (!isSetupMode && persisted.weekPlan) {
      html += renderThisWeekList(persisted.weekPlan, persisted.completedSessions);
    }

    html += `<div class="sect"><h2>Schedule</h2></div><div class="group">
      <div class="field"><div class="flabel"><b>Days per week${changedDot(screen.draft.daysPerWeek !== screen.saved.daysPerWeek)}</b></div>
        ${renderSegmented("days", dayOptions(), screen.draft.daysPerWeek)}
        <p class="hint">${daysPerWeekHint(screen.draft.daysPerWeek)}</p></div>
      <div class="field"><div class="flabel"><b>Session length${changedDot(screen.draft.sessionMinutes !== screen.saved.sessionMinutes)}</b></div>
        ${renderSegmented("mins", SESSION_LENGTH_OPTIONS, screen.draft.sessionMinutes, "min")}
        <p class="hint">Short sessions you do beat long ones you skip.</p></div>
    </div>`;

    const homeChanged =
      screen.draft.noHomeBells !== screen.saved.noHomeBells ||
      !arraysEqualSorted(screen.draft.homeBellsKg, screen.saved.homeBellsKg);
  html += `<div class="sect"><h2>Kettlebells</h2></div><div class="group">
      <p class="intro">Plans pick kettlebell, bodyweight and band moves first. Choose every bell you can use.</p>
      <div class="field"><div class="flabel"><b>At home${changedDot(homeChanged)}</b><span class="val">${screen.draft.noHomeBells ? "No bells" : summarizeBellRange(screen.draft.homeBellsKg)}</span></div>
        ${renderBellChips(
          "home",
          screen.draft.noHomeBells ? [] : screen.draft.homeBellsKg,
          config.equipment.availableBellsKg,
          `<button type="button" class="chip wide" aria-pressed="${screen.draft.noHomeBells}" data-act="nohome">${ICONS.ck}No bells at home</button>`,
        )}
        <p class="hint">${screen.draft.noHomeBells ? "Home sessions use bodyweight and band moves." : "Pick all that apply."}</p></div>
      <div class="field"><div class="flabel"><b>At the gym${changedDot(!arraysEqualSorted(screen.draft.gymBellsKg, screen.saved.gymBellsKg))}</b><button type="button" class="link" data-act="gymreset" ${gymDefault ? "disabled" : ""}>${gymDefault ? "Default range" : "Reset to default"}</button></div>
        ${renderBellChips("gym", screen.draft.gymBellsKg, config.equipment.availableBellsKg)}
        <p class="hint">${screen.draft.gymBellsKg.length ? `${summarizeBellRange(screen.draft.gymBellsKg)}. Default comes from the app config.` : "No gym bells: gym sessions use bodyweight, band and gym equipment."}</p></div>
    </div>`;

    html += `<div class="sect"><h2>Configured conditions</h2>${
      config.conditions.length
        ? `<span>${enabledCount} of ${config.conditions.length} on</span>`
        : ""
    }</div><div class="group">`;

    if (config.conditions.length === 0) {
      html += `<div class="empty">${ICONS.info}<p><b>No conditions configured.</b> Plans won't apply any condition cautions or swaps. Conditions come from the app's private config, not from this screen.</p></div>`;
    } else if (isSetupMode) {
      html += config.conditions
        .map((condition) => {
          const enabled = Boolean(screen.draft.conditionsEnabled[condition.id]);
          const changed = enabled !== Boolean(screen.saved.conditionsEnabled[condition.id]);
          const description = condition.description ?? "";
          return `<button type="button" class="trow" role="switch" aria-checked="${enabled}" data-act="cond" data-v="${condition.id}">
              <span class="txt"><span class="lb">${escapeHtml(condition.label)}${changedDot(changed)}</span><span class="ds">${escapeHtml(description)}</span></span><span class="switch" aria-hidden="true"></span></button>
              ${enabled ? "" : `<div class="offnote" role="note">${ICONS.warn}<p><b>Off:</b> its cautions and swaps stop applying. Exercises it rates high-risk can be scheduled.</p></div>`}`;
        })
        .join("");
    } else {
      html += config.conditions
        .map((condition) => {
          const enabled = Boolean(screen.draft.conditionsEnabled[condition.id]);
          const label = conditionLabels.conditionLabel(condition.id);
          const editedTag = conditionLabels.isEdited(condition.id)
            ? `<span class="etag">Edited</span>`
            : "";
          const notesLine = notesPreview(conditionLabels.conditionNotes(condition.id));
          return `<div class="crow">
              <button type="button" class="cedit" data-act="cond-edit" data-v="${condition.id}" aria-describedby="cond-edit-hint">
                <span class="txt"><span class="lb">${escapeHtml(label)}${editedTag}</span><span class="ds">${escapeHtml(notesLine)}</span></span>
                <span class="chev">${ICONS.chev}</span></button>
              <span class="vdiv" aria-hidden="true"></span>
              <button type="button" class="csw" role="switch" aria-checked="${enabled}" data-act="cond-switch" data-v="${condition.id}"
                aria-label="Use ${escapeHtml(label)} in plans"><span class="switch" aria-hidden="true"></span></button>
              </div>
              ${enabled ? "" : `<div class="offnote" role="note">${ICONS.warn}<p><b>Off:</b> its cautions and swaps stop applying. Exercises it rates high-risk can be scheduled.</p></div>`}`;
        })
        .join("");
    }
    html += `</div>${
      config.conditions.length
        ? `<p class="hint" id="cond-edit-hint" style="padding:0 var(--space-1)">${
            isSetupMode
              ? "On means plans follow that condition's cautions and swaps. All are on by default."
              : "On means plans follow that condition's cautions and swaps. Tap a name to rename it or edit its notes."
          }</p>`
        : ""
    }`;

    if (!isSetupMode && (onOpenMyExercises || onOpenHurtList)) {
      html += `<div class="sect"><h2>Library</h2></div><div class="group">`;
      if (onOpenMyExercises) {
        html += `<button type="button" class="nrow" data-act="open-my-exercises"><span class="txt"><span class="lb">My exercises</span><span class="ds">${myExerciseCount} added</span></span><span class="chev">${ICONS.chev}</span></button>`;
      }
      if (onOpenHurtList) {
        html += `<button type="button" class="nrow" data-act="open-hurt-list"><span class="txt"><span class="lb">Marked as hurt</span><span class="ds">${hurtExerciseCount} kept out of plans</span></span><span class="chev">${ICONS.chev}</span></button>`;
      }
      html += `</div>`;
    }

    const contact = config.disclaimerContact
      ? escapeHtml(config.disclaimerContact)
      : "your clinician";
    html += `<div class="sect"><h2>About</h2></div><div class="group">
      <button type="button" class="nrow" data-act="open-disclaimer"><span class="txt"><span class="lb">Not medical advice</span><span class="ds">${ackLabel ? `Acknowledged ${escapeHtml(ackLabel)}` : "Read before you start"}</span></span><span class="chev">${ICONS.chev}</span></button></div>`;

    root.className = "setup-shell";
    root.innerHTML = html;

    if (isSetupMode) {
      const helper =
        screen.draft.gymBellsKg.length > 0 ||
        (!screen.draft.noHomeBells && screen.draft.homeBellsKg.length > 0)
          ? "You can change this later in Settings."
          : "No bells picked: plans use bodyweight and bands.";
      bar.innerHTML = `<div class="in"><p class="help">${helper}</p><button class="primary" type="button" data-act="save">Start training</button></div>`;
    } else {
      const n = changeSummary.planAffectingChanges;
      bar.innerHTML = `<div class="in"><p class="help" aria-live="polite">${
        n ? `${n} change${n > 1 ? "s" : ""} · applies from your next plan` : "No changes"
      }</p><button class="primary" type="button" data-act="save" ${n ? "" : "disabled"}>Save</button></div>`;
    }

    const sheetOpen = screen.sheet !== null;
    document.body.classList.toggle("setup-locked", sheetOpen);
    root.inert = sheetOpen;
    bar.inert = sheetOpen;

    if (screen.sheet === "blocking") {
      layer.innerHTML = `<div class="scrim"><div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="setup-disclaimer-title">
        <div class="ic">${ICONS.shield}</div>
        <h2 id="setup-disclaimer-title">Not medical advice</h2>
        <p>This app plans workouts from the exercises in your library. It is not a doctor or a physiotherapist, and it can't tell whether an exercise is right for you.</p>
        <ul><li>Cautions and swaps follow fixed rules, not a medical assessment.</li><li>Stop any exercise that hurts and tap “This hurt”.</li></ul>
        <div class="contact">Check with <b>${contact}</b> before you start.</div>
        <button class="primary" type="button" data-act="ack-disclaimer">I understand</button>
        <p class="ack">Shown once. You can read it again in Settings.</p>
      </div></div>`;
    } else if (screen.sheet === "readonly") {
      layer.innerHTML = `<div class="scrim" data-act="close-disclaimer"><div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="setup-disclaimer-title">
        <div class="grab" aria-hidden="true"></div>
        <div class="ic">${ICONS.shield}</div>
        <h2 id="setup-disclaimer-title">Not medical advice</h2>
        <p>This app plans workouts from the exercises in your library. It is not a doctor or a physiotherapist, and it can't tell whether an exercise is right for you.</p>
        <ul><li>Cautions and swaps follow fixed rules, not a medical assessment.</li><li>Stop any exercise that hurts and tap “This hurt”.</li></ul>
        <div class="contact">Check with <b>${contact}</b> before you start.</div>
        <button class="secondary" type="button" data-act="close-disclaimer">Close</button>
        <p class="ack">${ackLabel ? `Acknowledged ${escapeHtml(ackLabel)}` : ""}</p>
      </div></div>`;
    } else {
      layer.innerHTML = "";
    }

    if (sheetOpen) {
      const sheet = layer.querySelector<HTMLElement>(".sheet");
      sheet?.focus();
    } else {
      restoreFocus(focusKey);
    }
  }

  function handleClick(event: MouseEvent): void {
    if (screen.editingConditionId) {
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) {
      return;
    }
    if (target.classList.contains("scrim") && event.target !== target) {
      return;
    }
    const act = target.dataset.act;
    const value = target.dataset.v;

    switch (act) {
      case "days":
        if (value) {
          screen.draft.daysPerWeek = clampDaysPerWeek(Number(value));
        }
        break;
      case "mins":
        if (value) {
          screen.draft.sessionMinutes = Number(value) as TrainingSettings["sessionMinutes"];
        }
        break;
      case "nohome":
        if (screen.draft.noHomeBells) {
          screen.draft.noHomeBells = false;
        } else {
          Object.assign(screen.draft, selectNoHomeBells());
        }
        break;
      case "home":
        if (value) {
          Object.assign(screen.draft, selectHomeBell(screen.draft.homeBellsKg, Number(value)));
        }
        break;
      case "gym":
        if (value) {
          screen.draft.gymBellsKg = selectHomeBell(screen.draft.gymBellsKg, Number(value)).homeBellsKg;
        }
        break;
      case "gymreset":
        screen.draft.gymBellsKg = [...config.equipment.gym.bellsKg];
        break;
      case "cond":
        if (value && screen.mode === "setup") {
          const current = Boolean(screen.draft.conditionsEnabled[value]);
          screen.draft.conditionsEnabled[value] = !current;
        }
        break;
      case "cond-edit":
        if (value) {
          openConditionEdit(value);
          return;
        }
        break;
      case "cond-switch":
        if (value && screen.mode === "settings") {
          screen.conditionSavedBanner = null;
          const draft = cloneSettings(screen.draft);
          draft.conditionsEnabled[value] = !Boolean(draft.conditionsEnabled[value]);
          applyImmediateSettings(draft);
        }
        break;
      case "open-disclaimer":
        screen.sheet = screen.sheet === "blocking" ? "blocking" : "readonly";
        break;
      case "ack-disclaimer":
        persisted = acknowledgeDisclaimer(persisted, config, new Date());
        screen.sheet = null;
        persist(persisted);
        break;
      case "close-disclaimer":
        screen.sheet = null;
        refocusDisclaimerRow = true;
        break;
      case "open-my-exercises":
        onOpenMyExercises?.();
        return;
      case "open-hurt-list":
        onOpenHurtList?.();
        return;
      case "save": {
        if (needsDisclaimerAcknowledgement(persisted, config)) {
          screen.sheet = "blocking";
          break;
        }
        const summary = summarizeSettingsChange(screen.saved, screen.draft);
        const nextSettings = cloneSettings(screen.draft);
        screen.saved = nextSettings;
        let next: PersistedAppState = {
          ...persisted,
          settings: nextSettings,
          setupComplete: true,
        };
        if (getPlanContext) {
          next = applyTrainingSettingsSave(next, nextSettings, summary, getPlanContext());
        }
        persist(next);
        screen.conditionSavedBanner = null;
        screen.mode = "settings";
        onSaved?.(next, summary);
        break;
      }
      default:
        break;
    }
    render();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && screen.sheet === "readonly") {
      screen.sheet = null;
      refocusDisclaimerRow = true;
      render();
    }
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  render();

  return {
    getState: () => persisted,
    destroy: () => {
      destroyConditionEdit();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
      bar.remove();
      layer.remove();
      root.innerHTML = "";
      root.className = "";
    },
  };
}

export function renderConfigError(root: HTMLElement, errors: readonly string[]): void {
  root.className = "setup-error";
  root.innerHTML = `<h1>Configuration problem</h1><p>${escapeHtml(errors.join(" "))} Plans cannot be built until private config is fixed.</p>`;
}

export function settingsAreDirty(saved: TrainingSettings, draft: TrainingSettings): boolean {
  return !settingsEqual(saved, draft);
}