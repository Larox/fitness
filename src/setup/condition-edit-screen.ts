import type { AppConfig, ConditionConfig } from "../config/types";
import { captureFocus, restoreFocus } from "../exercises/focus";
import {
  buildConditionOverridePatch,
  defaultConditionNotes,
  mergeConditionOverride,
  resolvedConditionLabel,
  resolvedConditionNotes,
  tidyConditionName,
  type ConditionOverrides,
} from "./condition-overrides";
import { createConditionLabelContext } from "./condition-labels";
import { escapeHtml, ICONS } from "./icons";
import type { PersistedAppState, TrainingSettings } from "./types";

export interface ConditionEditDraft {
  label: string;
  notes: string;
  enabled: boolean;
}

export interface MountConditionEditOptions {
  config: AppConfig;
  conditionId: string;
  root: HTMLElement;
  bar: HTMLElement;
  layer: HTMLElement;
  getPersisted: () => PersistedAppState;
  persistState: (next: PersistedAppState) => void;
  finalizeSave: (next: PersistedAppState) => void;
  onBack: (focusConditionId: string) => void;
  onSaved: (conditionId: string, savedName: string) => void;
}

interface EditScreenState {
  draft: ConditionEditDraft;
  saved: ConditionEditDraft;
  overrides: ConditionOverrides;
  showNameError: boolean;
  attemptedSave: boolean;
  resetUndo:
    | {
        previousOverride: ConditionOverrideEntry | undefined;
        previousDraft: ConditionEditDraft;
        defaultName: string;
      }
    | undefined;
  discardSheet: boolean;
  focusTarget: "title" | "name" | "saved" | "undo" | "reset" | null;
}

type ConditionOverrideEntry = ConditionOverrides[string];

function cloneDraft(draft: ConditionEditDraft): ConditionEditDraft {
  return { ...draft };
}

function draftFromSaved(
  condition: ConditionConfig,
  overrides: ConditionOverrides,
  settings: TrainingSettings,
): ConditionEditDraft {
  return {
    label: resolvedConditionLabel(condition, overrides),
    notes: resolvedConditionNotes(condition, overrides),
    enabled: Boolean(settings.conditionsEnabled[condition.id]),
  };
}

function draftsEqual(a: ConditionEditDraft, b: ConditionEditDraft): boolean {
  return (
    tidyConditionName(a.label) === tidyConditionName(b.label) &&
    a.notes.trim() === b.notes.trim() &&
    a.enabled === b.enabled
  );
}

function otherConditionDuplicateLabel(
  config: AppConfig,
  overrides: ConditionOverrides,
  currentId: string,
  draftLabel: string,
): boolean {
  const tidy = tidyConditionName(draftLabel).toLowerCase();
  if (!tidy) {
    return false;
  }
  for (const condition of config.conditions) {
    if (condition.id === currentId) {
      continue;
    }
    const other = resolvedConditionLabel(condition, overrides).toLowerCase();
    if (other === tidy) {
      return true;
    }
  }
  return false;
}

function notesPreview(notes: string): string {
  const trimmed = notes.trim();
  return trimmed.length ? trimmed : "No notes";
}

export function mountConditionEditScreen(options: MountConditionEditOptions): {
  destroy: () => void;
} {
  const {
    config,
    conditionId,
    root,
    bar,
    layer,
    getPersisted,
    persistState,
    finalizeSave,
    onBack,
    onSaved,
  } = options;
  const found = config.conditions.find((c) => c.id === conditionId);
  if (!found) {
    onBack(conditionId);
    return { destroy: () => {} };
  }
  const condition = found;

  const persisted = getPersisted();
  const overrides = { ...(persisted.conditionOverrides ?? {}) };
  const labels = createConditionLabelContext(config, overrides);

  const screen: EditScreenState = {
    draft: draftFromSaved(condition, overrides, persisted.settings),
    saved: draftFromSaved(condition, overrides, persisted.settings),
    overrides,
    showNameError: false,
    attemptedSave: false,
    resetUndo: undefined,
    discardSheet: false,
    focusTarget: "title",
  };

  let kbBound = false;

  function syncKeyboardOffset(): void {
    if (!window.visualViewport) {
      return;
    }
    const offset = Math.max(
      0,
      window.innerHeight -
        window.visualViewport.height -
        window.visualViewport.offsetTop,
    );
    document.documentElement.style.setProperty("--kb-offset", `${offset}px`);
    document.body.classList.toggle("setup-kb", offset > 0);
  }

  function bindKeyboard(): void {
    if (kbBound) {
      return;
    }
    kbBound = true;
    window.visualViewport?.addEventListener("resize", syncKeyboardOffset);
    window.visualViewport?.addEventListener("scroll", syncKeyboardOffset);
    syncKeyboardOffset();
  }

  function unbindKeyboard(): void {
    if (!kbBound) {
      return;
    }
    kbBound = false;
    window.visualViewport?.removeEventListener("resize", syncKeyboardOffset);
    window.visualViewport?.removeEventListener("scroll", syncKeyboardOffset);
    document.documentElement.style.removeProperty("--kb-offset");
    document.body.classList.remove("setup-kb");
  }

  function showReset(): boolean {
    return (
      screen.overrides[conditionId] !== undefined ||
      tidyConditionName(screen.draft.label) !== condition.label ||
      screen.draft.notes.trim() !== defaultConditionNotes(condition)
    );
  }

  function nameCounterClass(length: number): string {
    if (length >= 36) {
      return "count near";
    }
    if (length >= 30) {
      return "count near";
    }
    return "count";
  }

  function notesCounterClass(length: number): string {
    return length >= 260 ? "count near" : "count";
  }

  function renderFields(): string {
    const nameLen = screen.draft.label.length;
    const notesLen = screen.draft.notes.length;
    const tidyName = tidyConditionName(screen.draft.label);
    const nameError =
      screen.showNameError && !tidyName
        ? `<p class="ferr" id="cond-name-err" role="alert"><span aria-hidden="true">${ICONS.warn}</span>Give it a name (1 to 40 characters).</p>`
        : "";
    const dupWarn = otherConditionDuplicateLabel(
      config,
      screen.overrides,
      conditionId,
      screen.draft.label,
    )
      ? `<p class="fwarn" id="cond-name-warn"><span aria-hidden="true">${ICONS.warn}</span>Same as the other condition’s name. That’s allowed, but they’ll be hard to tell apart.</p>`
      : "";

    return `<div class="sect"><h2>Details</h2></div><div class="group">
      <div class="field">
        <div class="flabel"><label for="cond-name" class="lbl">Name</label><span class="opt">Required</span></div>
        <input class="inp" id="cond-name" data-act="cond-name" type="text" maxlength="40" enterkeyhint="next"
          value="${escapeHtml(screen.draft.label)}" aria-required="true"
          aria-describedby="cond-name-hint cond-name-meta${screen.showNameError && !tidyName ? " cond-name-err" : dupWarn ? " cond-name-warn" : ""}"
          ${screen.showNameError && !tidyName ? 'aria-invalid="true"' : ""} />
        <div class="fmeta" id="cond-name-meta">
          <span id="cond-name-hint" class="hint" style="margin:0">Shows in Today, your exercises and the hurt list.</span>
          ${nameLen >= 30 ? `<span class="${nameCounterClass(nameLen)}" aria-live="polite">${nameLen}/40</span>` : ""}
        </div>
        ${nameError}
        ${dupWarn}
      </div>
      <div class="field">
        <div class="flabel"><label for="cond-notes" class="lbl">Notes</label><span class="opt">Optional</span></div>
        <textarea class="inp" id="cond-notes" data-act="cond-notes" maxlength="280" enterkeyhint="done"
          aria-describedby="cond-notes-hint cond-notes-meta${dupWarn ? "" : ""}"
        >${escapeHtml(screen.draft.notes)}</textarea>
        <div class="fmeta" id="cond-notes-meta">
          <span id="cond-notes-hint" class="hint" style="margin:0">Shows under the name in Settings.</span>
          <span class="${notesCounterClass(notesLen)}" aria-live="polite">${notesLen}/280</span>
        </div>
      </div>
      <button type="button" class="etrow" role="switch" aria-checked="${screen.draft.enabled}" data-act="cond-plan"
        aria-label="Use ${escapeHtml(labels.conditionLabel(conditionId))} in plans">
        <span class="txt"><span class="lb">Use in plans</span><span class="ds">${
          screen.draft.enabled
            ? "Plans follow its cautions and swaps"
            : "Off: its cautions and swaps stop applying"
        }</span></span><span class="switch" aria-hidden="true"></span></button>
    </div>
    <p class="phone">${ICONS.shield}<span><b>Saved on this phone only.</b></span></p>
    <div class="resetw" ${showReset() ? "" : "hidden"} id="cond-reset-wrap">
      <button type="button" class="textbtn" data-act="cond-reset" id="cond-reset-btn">Reset to default</button>
      <span>Back to the name “${escapeHtml(condition.label)}” and its default notes. Keeps on/off.</span>
    </div>`;
  }

  function renderStatusRows(): string {
    if (screen.resetUndo) {
      return `<div class="undorow" role="status" id="cond-undo-row" tabindex="-1">
        <p><b>Reset to “${escapeHtml(screen.resetUndo.defaultName)}”</b> Your name and notes for it were removed from this phone.</p>
        <button type="button" class="undo" data-act="cond-undo">Undo</button>
      </div>`;
    }
    return "";
  }

  function renderChrome(): void {
    const dirty = !draftsEqual(screen.draft, screen.saved);
    const tidyName = tidyConditionName(screen.draft.label);
    const barHelper = !dirty
      ? "No changes"
      : !tidyName && screen.attemptedSave
        ? "Add a name to save"
        : "Ready to save · the new name shows everywhere";

    bar.innerHTML = `<div class="in"><p class="help${!tidyName && screen.attemptedSave ? " bad" : ""}" aria-live="polite">${barHelper}</p>
      <button class="primary" type="button" data-act="cond-save" ${dirty && tidyName ? "" : "disabled"}>Save</button></div>`;

    const resetWrap = root.querySelector("#cond-reset-wrap");
    if (resetWrap) {
      resetWrap.toggleAttribute("hidden", !showReset());
    }

    const nameMeta = root.querySelector("#cond-name-meta");
    if (nameMeta) {
      const len = screen.draft.label.length;
      const counter =
        len >= 30
          ? `<span class="${nameCounterClass(len)}" aria-live="polite">${len}/40</span>`
          : "";
      nameMeta.innerHTML = `<span id="cond-name-hint" class="hint" style="margin:0">Shows in Today, your exercises and the hurt list.</span>${counter}`;
    }

    const notesMeta = root.querySelector("#cond-notes-meta");
    if (notesMeta) {
      const len = screen.draft.notes.length;
      notesMeta.innerHTML = `<span id="cond-notes-hint" class="hint" style="margin:0">Shows under the name in Settings.</span>
        <span class="${notesCounterClass(len)}" aria-live="polite">${len}/280</span>`;
    }

    const nameInput = root.querySelector<HTMLInputElement>("#cond-name");
    if (nameInput) {
      const invalid = screen.showNameError && !tidyName;
      if (invalid) {
        nameInput.setAttribute("aria-invalid", "true");
      } else {
        nameInput.removeAttribute("aria-invalid");
      }
    }

    const errExisting = root.querySelector("#cond-name-err");
    const warnExisting = root.querySelector("#cond-name-warn");
    errExisting?.remove();
    warnExisting?.remove();

    const nameField = root.querySelector("#cond-name")?.closest(".field");
    if (nameField) {
      if (screen.showNameError && !tidyName) {
        nameField.insertAdjacentHTML(
          "beforeend",
          `<p class="ferr" id="cond-name-err" role="alert"><span aria-hidden="true">${ICONS.warn}</span>Give it a name (1 to 40 characters).</p>`,
        );
      } else if (
        otherConditionDuplicateLabel(
          config,
          screen.overrides,
          conditionId,
          screen.draft.label,
        )
      ) {
        nameField.insertAdjacentHTML(
          "beforeend",
          `<p class="fwarn" id="cond-name-warn"><span aria-hidden="true">${ICONS.warn}</span>Same as the other condition’s name. That’s allowed, but they’ll be hard to tell apart.</p>`,
        );
      }
    }

    const planRow = root.querySelector<HTMLButtonElement>('[data-act="cond-plan"]');
    if (planRow) {
      planRow.setAttribute("aria-checked", String(screen.draft.enabled));
      const ds = planRow.querySelector(".ds");
      if (ds) {
        ds.textContent = screen.draft.enabled
          ? "Plans follow its cautions and swaps"
          : "Off: its cautions and swaps stop applying";
      }
    }

    let statusHost = root.querySelector("#cond-status-host");
    if (!statusHost) {
      const hdr = root.querySelector(".hdr");
      statusHost = document.createElement("div");
      statusHost.id = "cond-status-host";
      hdr?.after(statusHost);
    }
    statusHost.innerHTML = renderStatusRows();
  }

  function renderFull(): void {
    const focus = captureFocus(root, bar);
    const displayName = labels.conditionLabel(conditionId);

    root.className = "setup-shell setup-sub-page";
    root.innerHTML = `<nav class="nav"><button type="button" class="back" data-act="cond-back" data-v="${conditionId}">‹ Settings</button></nav>
      <header class="hdr"><p class="overline">Configured condition</p>
      <h1 class="title" id="cond-edit-title" tabindex="-1">${escapeHtml(displayName)}</h1>
      <p class="sub">Plans still follow its cautions and swaps.</p></header>
      <div id="cond-status-host">${renderStatusRows()}</div>
      ${renderFields()}`;

    autoGrowNotes();
    renderChrome();

    if (screen.discardSheet) {
      layer.innerHTML = `<div class="scrim"><div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="discard-title">
        <h2 id="discard-title">Discard changes?</h2>
        <p>Your edits to this condition won’t be saved.</p>
        <button class="primary" type="button" data-act="cond-keep-editing">Keep editing</button>
        <button class="secondary" type="button" data-act="cond-discard" style="margin-top:12px">Discard</button>
      </div></div>`;
      document.body.classList.add("setup-locked");
      root.inert = true;
      bar.inert = true;
      layer.querySelector<HTMLElement>(".sheet")?.focus();
    } else {
      layer.innerHTML = "";
      document.body.classList.remove("setup-locked");
      root.inert = false;
      bar.inert = false;
      if (screen.focusTarget === "title") {
        root.querySelector<HTMLElement>("#cond-edit-title")?.focus();
        screen.focusTarget = null;
      } else if (screen.focusTarget === "name") {
        root.querySelector<HTMLElement>("#cond-name")?.focus();
        screen.focusTarget = null;
      } else if (screen.focusTarget === "undo") {
        root.querySelector<HTMLElement>('[data-act="cond-undo"]')?.focus();
        screen.focusTarget = null;
      } else if (screen.focusTarget === "reset") {
        root.querySelector<HTMLElement>("#cond-reset-btn")?.focus();
        screen.focusTarget = null;
      } else {
        restoreFocus(focus, root, bar);
      }
    }
  }

  function autoGrowNotes(): void {
    const area = root.querySelector<HTMLTextAreaElement>("#cond-notes");
    if (!area) {
      return;
    }
    area.style.height = "auto";
    area.style.height = `${Math.max(96, area.scrollHeight)}px`;
  }

  function commitSave(): void {
    const tidyName = tidyConditionName(screen.draft.label);
    if (!tidyName) {
      screen.attemptedSave = true;
      screen.showNameError = true;
      screen.focusTarget = "name";
      renderChrome();
      root.querySelector<HTMLElement>("#cond-name")?.focus();
      return;
    }

    const patch = buildConditionOverridePatch(
      condition,
      { label: screen.draft.label, notes: screen.draft.notes },
      new Date().toISOString(),
    );
    screen.overrides = mergeConditionOverride(screen.overrides, conditionId, patch);

    const settings = structuredClone(getPersisted().settings);
    settings.conditionsEnabled[conditionId] = screen.draft.enabled;

    const next: PersistedAppState = {
      ...getPersisted(),
      settings,
      conditionOverrides:
        Object.keys(screen.overrides).length > 0 ? { ...screen.overrides } : undefined,
    };
    finalizeSave(next);
    screen.saved = cloneDraft(screen.draft);
    screen.resetUndo = undefined;
    onSaved(conditionId, tidyName);
  }

  function handleInput(event: Event): void {
    const target = event.target as HTMLElement;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    const act = target.dataset.act;
    screen.resetUndo = undefined;
    if (act === "cond-name") {
      screen.draft.label = target.value;
      if (tidyConditionName(screen.draft.label)) {
        screen.showNameError = false;
      }
    } else if (act === "cond-notes") {
      screen.draft.notes = target.value;
      autoGrowNotes();
    }
    renderChrome();
  }

  function handleClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) {
      return;
    }
    const act = target.dataset.act;

    switch (act) {
      case "cond-name":
      case "cond-notes":
        return;
      case "cond-plan":
        screen.draft.enabled = !screen.draft.enabled;
        screen.resetUndo = undefined;
        renderFull();
        return;
      case "cond-reset": {
        const previousOverride = screen.overrides[conditionId]
          ? { ...screen.overrides[conditionId]! }
          : undefined;
        const previousDraft = cloneDraft(screen.draft);
        screen.overrides = mergeConditionOverride(screen.overrides, conditionId, null);
        screen.draft = {
          label: condition.label,
          notes: defaultConditionNotes(condition),
          enabled: screen.draft.enabled,
        };
        screen.resetUndo = {
          previousOverride,
          previousDraft,
          defaultName: condition.label,
        };
        persistState({
          ...getPersisted(),
          conditionOverrides:
            Object.keys(screen.overrides).length > 0
              ? { ...screen.overrides }
              : undefined,
        });
        screen.showNameError = false;
        screen.focusTarget = "undo";
        renderFull();
        return;
      }
      case "cond-undo": {
        if (!screen.resetUndo) {
          return;
        }
        screen.overrides = mergeConditionOverride(
          screen.overrides,
          conditionId,
          screen.resetUndo.previousOverride ?? null,
        );
        screen.draft = cloneDraft(screen.resetUndo.previousDraft);
        screen.resetUndo = undefined;
        persistState({
          ...getPersisted(),
          conditionOverrides:
            Object.keys(screen.overrides).length > 0
              ? { ...screen.overrides }
              : undefined,
        });
        screen.focusTarget = "reset";
        renderFull();
        return;
      }
      case "cond-save":
        commitSave();
        return;
      case "cond-back": {
        if (!draftsEqual(screen.draft, screen.saved)) {
          screen.discardSheet = true;
          renderFull();
          return;
        }
        onBack(conditionId);
        return;
      }
      case "cond-keep-editing":
        screen.discardSheet = false;
        renderFull();
        return;
      case "cond-discard":
        screen.discardSheet = false;
        onBack(conditionId);
        return;
      default:
        break;
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      const act = event.target.dataset.act;
      if (act === "cond-name") {
        event.preventDefault();
        root.querySelector<HTMLTextAreaElement>("#cond-notes")?.focus();
      }
    }
  }

  root.addEventListener("input", handleInput);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  bindKeyboard();
  renderFull();

  return {
    destroy: () => {
      root.removeEventListener("input", handleInput);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
      unbindKeyboard();
      layer.innerHTML = "";
    },
  };
}

export { notesPreview };