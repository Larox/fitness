import type { AppConfig } from "../config/types";
import type { NormalizedExercise } from "../library/types";
import { escapeHtml, ICONS } from "../setup/icons";
import { mergePersistedState } from "../setup/merge";
import type { PersistedAppState } from "../setup/types";
import type { SettingsStorage } from "../setup/storage";
import {
  barHelperForRisks,
  collectLibraryCategories,
  draftToUserExercise,
  emptyExerciseDraft,
  userExerciseToDraft,
} from "./form-helpers";
import { captureFocus, restoreFocus } from "./focus";
import { formatDosePreview, clampHoldSeconds, clampReps, clampSets } from "./dose";
import {
  buildHurtListDisplayRows,
  formatMarkedDate,
  restoreHurtExercise,
  undoHurtRestore,
} from "./hurt";
import { deleteUserExercise } from "./delete";
import { unsetRiskCount, isRiskExplicitlySet } from "./risk";
import { validateExerciseForm, type ValidationIssue } from "./validation";
import type { ExerciseFormDraft, UserExercise } from "./types";
import { normalizeSourceUrl } from "./url";

type View = "my" | "form" | "hurt";

export interface MountExerciseFlowOptions {
  config: AppConfig;
  storage: SettingsStorage;
  root: HTMLElement;
  libraryExercises: readonly NormalizedExercise[];
  libraryRoutines: readonly { categories: string[] }[];
  initialView: View;
  editId?: string;
  onBackToSettings: () => void;
}

function cloneState(state: PersistedAppState): PersistedAppState {
  return structuredClone(state);
}

export function mountExerciseFlow(options: MountExerciseFlowOptions): { destroy: () => void } {
  const { config, storage, root, libraryExercises, onBackToSettings } = options;
  const categories = collectLibraryCategories(options.libraryRoutines);

  let view: View = options.initialView;
  let persisted = cloneState(mergePersistedState(storage.load(), config));
  if (!persisted.userExercises) persisted.userExercises = [];
  if (!persisted.hurtExclusions) persisted.hurtExclusions = [];
  if (!persisted.deletedExerciseHistory) persisted.deletedExerciseHistory = [];
  if (!persisted.weekSessionsRemaining) persisted.weekSessionsRemaining = [];

  let editing: UserExercise | null =
    options.editId != null
      ? (persisted.userExercises.find((e) => e.id === options.editId) ?? null)
      : null;
  let draft: ExerciseFormDraft = editing
    ? userExerciseToDraft(editing)
    : emptyExerciseDraft();
  let savedDraftJson = JSON.stringify(draft);
  let attemptedSave = false;
  let statusMessage: string | null = null;
  let explicitFocusId: string | null = null;

  const bar = document.createElement("div");
  bar.className = "exercise-bar";
  bar.id = "exercise-bar";
  document.body.classList.add("exercise-has-bar");
  document.body.appendChild(bar);

  function exerciseName(exerciseId: string): string {
    const lib = libraryExercises.find((e) => e.id === exerciseId);
    if (lib) return lib.name;
    const user = persisted.userExercises?.find((e) => e.id === exerciseId);
    return user?.name ?? exerciseId;
  }

  function persist(next: PersistedAppState): void {
    persisted = next;
    storage.save(next);
  }

  function commitPendingUndo(): void {
    if (persisted.pendingHurtRestore) {
      persisted = { ...persisted, pendingHurtRestore: undefined };
      persist(persisted);
    }
  }

  function libraryDoseLabel(exercise: NormalizedExercise): string {
    const sets = exercise.sets ?? 1;
    const reps = exercise.reps ?? "—";
    return `${sets} × ${reps}`;
  }

  function renderRiskSegment(
    conditionId: string,
    conditionLabel: string,
    chosen: ExerciseFormDraft,
  ): string {
    const level = chosen.riskChosen[conditionId];
    const explicit = isRiskExplicitlySet({ riskChosen: chosen.riskChosen }, conditionId);
    const unsetPill = explicit
      ? ""
      : `<span class="risk-pill">Not set yet · treated as high</span>`;
    const levels = ["low", "moderate", "high"] as const;
    const buttons = levels
      .map((l) => {
        const checked =
          explicit && level === l ? "true" : !explicit && l === "high" ? "true" : "false";
        return `<button type="button" role="radio" data-level="${l}" aria-checked="${checked}" data-act="risk" data-v="${conditionId}:${l}">${l}</button>`;
      })
      .join("");
    const caution =
      level === "moderate"
        ? `<div class="caution-field"><label for="caution-${conditionId}">Caution shown in Today <span>Optional</span></label>
          <textarea class="areain" id="caution-${conditionId}" data-act="caution" data-v="${conditionId}" rows="3">${escapeHtml(chosen.moderateCautions[conditionId] ?? "")}</textarea></div>`
        : "";
    return `<div class="field"><div><b>${escapeHtml(conditionLabel)}</b>${unsetPill}
      <div class="seg risk-seg" role="radiogroup" aria-label="${escapeHtml(conditionLabel)} risk">${buttons}</div>
      ${caution}</div></div>`;
  }

  function renderForm(): string {
    const isEdit = editing !== null;
    const unset = unsetRiskCount({ riskChosen: draft.riskChosen }, config.conditions);
    const issues = validateExerciseForm({
      draft,
      conditions: config.conditions,
      libraryExercises,
      userNames: (persisted.userExercises ?? []).map((e) => ({ id: e.id, name: e.name })),
      editingId: editing?.id,
      validateNow: attemptedSave,
    });
    const errSummary =
      issues.length > 0
        ? `<div class="errsum" role="alert"><b>Fix these ${issues.length} to save</b><ul>${issues
            .map((i) => `<li><a href="#" data-act="focus-field" data-v="${i.field}">${escapeHtml(i.message)}</a></li>`)
            .join("")}</ul></div>`
        : "";

    let html = `<button type="button" class="back" data-act="back-my">‹ My exercises</button>
      <header class="hdr"><h1 class="title" id="exercise-form-title" tabindex="-1">${isEdit ? "Edit exercise" : "Add exercise"}</h1>
      <p class="sub">${isEdit ? "Changes apply from your next plan." : "The coach only plans with exercises in your library."}</p></header>
      ${errSummary}
      <div class="sect"><h2>Basics</h2></div><div class="group">
        <div class="field"><label class="flabel" for="ex-name"><b>Name</b><span>Required</span></label>
          <input class="textin" id="ex-name" data-act="name" value="${escapeHtml(draft.name)}" aria-required="true" ${fieldInvalid("name", issues)} />
          ${fieldError("name", issues)}</div>
        <div class="field"><span class="flabel"><b>Category</b></span>
          <div class="chips" role="group" aria-label="Category">${categories
            .map(
              (cat) =>
                `<button type="button" class="chip" aria-pressed="${draft.categories.includes(cat)}" data-act="cat" data-v="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`,
            )
            .join("")}</div></div>
        <div class="field"><label class="flabel" for="ex-equipment"><b>Equipment</b></label>
          <input class="textin" id="ex-equipment" data-act="equipment" value="${escapeHtml(draft.equipment)}" enterKeyHint="next" /></div>
        <div class="field"><button type="button" class="trow" role="switch" aria-checked="${draft.kettlebell}" data-act="kettlebell"><span class="txt"><b>Uses a kettlebell</b></span><span class="switch" aria-hidden="true"></span></button></div>
        <div class="field"><span class="flabel"><b>Where</b></span>
          <div class="seg" role="radiogroup" aria-label="Where">
            <button type="button" role="radio" aria-checked="${!draft.location}" data-act="where" data-v="either">Either</button>
            <button type="button" role="radio" aria-checked="${draft.location === "home"}" data-act="where" data-v="home">Home</button>
            <button type="button" role="radio" aria-checked="${draft.location === "gym"}" data-act="where" data-v="gym">Gym</button>
          </div></div>
      </div>
      <div class="sect"><h2>Dose</h2></div><div class="group">
        <div class="field"><span class="flabel"><b>Dose type</b></span>
          <div class="seg" role="radiogroup" aria-label="Dose type">
            <button type="button" role="radio" aria-checked="${draft.dose.mode === "reps"}" data-act="dose-mode" data-v="reps">Reps</button>
            <button type="button" role="radio" aria-checked="${draft.dose.mode === "hold"}" data-act="dose-mode" data-v="hold">Hold (seconds)</button>
          </div></div>
        <div class="field"><span class="flabel"><b>Sets</b></span>
          <div class="seg"><button type="button" data-act="sets-dec">−</button>
            <input class="textin" inputmode="numeric" data-act="sets" value="${draft.dose.sets}" style="width:64px;text-align:center" />
            <button type="button" data-act="sets-inc">+</button></div></div>
        <div class="field"><span class="flabel"><b>${draft.dose.mode === "hold" ? "Seconds" : "Reps"}</b></span>
          <div class="seg"><button type="button" data-act="dose-dec">−</button>
            <input class="textin" inputmode="numeric" data-act="dose-val" value="${draft.dose.mode === "hold" ? draft.dose.holdS ?? 30 : draft.dose.reps ?? 10}" style="width:64px;text-align:center" />
            <button type="button" data-act="dose-inc">+</button></div></div>
        <div class="field"><button type="button" class="trow" role="switch" aria-checked="${draft.dose.perSide}" data-act="per-side"><span class="txt"><b>Per side</b></span><span class="switch" aria-hidden="true"></span></button></div>
        <div class="field"><p class="preview" id="dose-preview">Shows as <b>${escapeHtml(formatDosePreview(draft.dose))}</b></p></div>
      </div>
      <div class="sect"><h2>Cues</h2></div><div class="group" id="cue-group">${draft.cues
        .map(
          (cue, i) =>
            `<div class="field"><label class="visually-hidden" for="cue-${i}">Cue ${i + 1}</label>
              <input class="textin" id="cue-${i}" data-act="cue" data-v="${i}" value="${escapeHtml(cue)}" enterKeyHint="${i === draft.cues.length - 1 ? "done" : "next"}" />
              ${draft.cues.length > 1 ? `<button type="button" data-act="cue-remove" data-v="${i}">×</button>` : ""}</div>`,
        )
        .join("")}
        ${draft.cues.length < 6 ? `<div class="field"><button type="button" class="link" data-act="cue-add">+ Add a cue</button></div>` : ""}
      </div>
      <div class="sect"><h2>Source</h2></div><div class="group">
        <div class="field"><label class="flabel" for="ex-link"><b>Link</b></label>
          <input class="textin" id="ex-link" type="url" data-act="link" value="${escapeHtml(draft.link)}" enterKeyHint="done" ${fieldInvalid("link", issues)} />
          ${fieldError("link", issues)}
          <p class="hint">Opens outside the app. No video plays here.</p></div>
      </div>`;

    html += `<div class="sect"><h2>Risk per condition</h2>${
      config.conditions.length ? `<span>${config.conditions.length - unset} of ${config.conditions.length} set</span>` : ""
    }</div><div class="group">`;
    if (config.conditions.length === 0) {
      html += `<div class="empty">${ICONS.info}<p><b>No conditions configured.</b> Risk levels aren’t needed. The exercise can be planned as soon as you save it.</p></div>`;
    } else {
      html += config.conditions
        .map((c) => renderRiskSegment(c.id, c.label, draft))
        .join("");
    }
    html += `</div>`;
    if (isEdit) {
      html += `<button type="button" class="delete" data-act="delete">Delete exercise</button>`;
    }
    return html;
  }

  function fieldInvalid(field: string, issues: ValidationIssue[]): string {
    return issues.some((i) => i.field === field) ? 'aria-invalid="true"' : "";
  }

  function fieldError(field: string, issues: ValidationIssue[]): string {
    const issue = issues.find((i) => i.field === field);
    return issue
      ? `<p class="err" id="err-${field}" role="alert">${escapeHtml(issue.message)}</p>`
      : "";
  }

  function renderMyList(): string {
    const rows = persisted.userExercises ?? [];
    const hurtCount = persisted.hurtExclusions?.length ?? 0;
    const list = rows
      .map((row) => {
        const unset = unsetRiskCount(row, config.conditions);
        const tag =
          unset > 0
            ? `<span class="tag tag-warn">${unset} risk not set · won’t be planned</span>`
            : "";
        const isNew = row.newUntil && new Date(row.newUntil) > new Date();
        return `<button type="button" class="nrow" data-act="open-edit" data-v="${row.id}"><span class="txt"><b>${escapeHtml(row.name)}</b>${isNew ? '<span class="tag tag-new">New</span>' : ""}${tag}<br/><span class="preview">${escapeHtml(formatDosePreview(row.dose))}</span></span>${ICONS.chev}</button>`;
      })
      .join("");
    const importedRows = libraryExercises
      .map(
        (exercise) =>
          `<div class="nrow" aria-disabled="true"><span class="txt"><b>${escapeHtml(exercise.name)}</b><br/><span class="preview">${escapeHtml(libraryDoseLabel(exercise))}</span><span class="ds">Imported · read-only</span></span></div>`,
      )
      .join("");
    return `<button type="button" class="back" data-act="back-settings">‹ Settings</button>
      <h1 class="title" id="my-title" tabindex="-1">My exercises</h1>
      <p class="sub">Exercises you added. The coach plans only from your library.</p>
      ${statusMessage ? `<p class="status-toast" role="status">${escapeHtml(statusMessage)}</p>` : ""}
      <div class="sect"><h2>Yours · ${rows.length}</h2></div>
      <div class="group">${list || `<div class="empty">${ICONS.info}<p>No exercises yet.</p></div>`}</div>
      <div class="sect"><h2>Imported · read-only</h2></div>
      <div class="group">${importedRows || `<div class="empty">${ICONS.info}<p>No imported exercises.</p></div>`}</div>
      <div class="sect"><h2>Library</h2></div>
      <div class="group"><button type="button" class="nrow" data-act="open-hurt"><span class="txt"><b>Marked as hurt</b><span class="ds">${hurtCount} kept out of plans</span></span>${ICONS.chev}</button></div>`;
  }

  function renderHurtList(): string {
    const exclusions = persisted.hurtExclusions ?? [];
    const displayRows = buildHurtListDisplayRows(exclusions, persisted.pendingHurtRestore);
    const body = displayRows
      .map((row) => {
        const name = exerciseName(row.exerciseId);
        if (row.showUndoSuccess) {
          return `<div class="undo-row" role="status"><b>${escapeHtml(name)} restored</b>. Back in future plans. Risk levels unchanged.
              <button type="button" id="undo-restore-${row.exerciseId}" data-act="undo-restore" data-v="${row.exerciseId}">Undo</button></div>`;
        }
        return `<div class="restore-row"><div><b>${escapeHtml(name)}</b>
          <p class="sub">Marked ${escapeHtml(formatMarkedDate(row.markedAt))} · from ${escapeHtml(row.from)}</p></div>
          <button type="button" class="restore-pill" id="restore-pill-${row.exerciseId}" data-act="restore" data-v="${row.exerciseId}" aria-label="Restore ${escapeHtml(name)}">Restore</button></div>`;
      })
      .join("");
    const empty =
      displayRows.length === 0
        ? `<div class="empty">${ICONS.info}<p><b>Nothing marked as hurt.</b> When you tap “This hurt” on an exercise, it shows up here and stays out of your plans until you restore it.</p></div>`
        : "";
    return `<button type="button" class="back" data-act="back-settings">‹ Settings</button>
      <h1 class="title" tabindex="-1">Marked as hurt</h1>
      <p class="sub">These stay out of your plans until you restore them.</p>
      <div class="sect"><h2>Kept out of plans · ${exclusions.length}</h2></div>
      <div class="group">${displayRows.length ? body : empty}</div>
      <p class="hint">Restoring only lifts the “hurt” flag. Its risk levels stay as they were.</p>`;
  }

  function renderBar(): void {
    if (view === "form") {
      const dirty = JSON.stringify(draft) !== savedDraftJson;
      const unset = unsetRiskCount({ riskChosen: draft.riskChosen }, config.conditions);
      const isEdit = editing !== null;
      const issues = validateExerciseForm({
        draft,
        conditions: config.conditions,
        libraryExercises,
        userNames: (persisted.userExercises ?? []).map((e) => ({ id: e.id, name: e.name })),
        editingId: editing?.id,
        validateNow: attemptedSave,
      });
      const helper = attemptedSave && issues.length
        ? `Fix ${issues.length} field${issues.length > 1 ? "s" : ""} above to save`
        : barHelperForRisks(unset, isEdit, dirty);
      const danger = attemptedSave && issues.length > 0;
      bar.innerHTML = `<div class="in"><p class="help ${danger ? "danger" : ""}">${escapeHtml(helper)}</p>
        <button class="primary" type="button" data-act="save" ${isEdit && !dirty ? "disabled" : ""}>${isEdit ? "Save changes" : "Save exercise"}</button></div>`;
      bar.style.display = "";
      return;
    }
    if (view === "my") {
      bar.innerHTML = `<div class="in"><button class="primary" type="button" data-act="add-new">Add exercise</button></div>`;
      bar.style.display = "";
      return;
    }
    bar.style.display = "none";
  }

  function render(partial = false): void {
    const focus = captureFocus(root, bar);
    if (partial && view === "form") {
      const preview = root.querySelector("#dose-preview");
      if (preview) {
        preview.innerHTML = `Shows as <b>${escapeHtml(formatDosePreview(draft.dose))}</b>`;
      }
      renderBar();
      return;
    }

    root.className = "exercise-shell";
    if (view === "form") {
      root.innerHTML = renderForm();
    } else if (view === "hurt") {
      root.innerHTML = renderHurtList();
    } else {
      root.innerHTML = renderMyList();
    }
    renderBar();

    if (explicitFocusId) {
      const id = explicitFocusId;
      explicitFocusId = null;
      document.getElementById(id)?.focus();
    } else if (view !== "hurt") {
      restoreFocus(focus, root, bar);
    } else {
      restoreFocus(focus, root, bar);
    }
  }

  function saveDraftFieldFromTarget(target: HTMLElement, value: string): void {
    const act = target.dataset.act;
    if (act === "name") draft.name = value;
    else if (act === "equipment") draft.equipment = value;
    else if (act === "link") draft.link = value;
    else if (act === "caution" && target.dataset.v) {
      draft.moderateCautions[target.dataset.v] = value;
    } else if (act === "cue" && target.dataset.v) {
      const i = Number(target.dataset.v);
      draft.cues[i] = value;
    } else if (act === "sets") {
      draft.dose.sets = clampSets(Number(value) || 1);
    } else if (act === "dose-val") {
      if (draft.dose.mode === "hold") {
        draft.dose.holdS = clampHoldSeconds(Number(value) || 5);
      } else {
        draft.dose.reps = clampReps(Number(value) || 1);
      }
    }
  }

  function handleInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
  saveDraftFieldFromTarget(target, target.value);
    if (attemptedSave) {
      render();
      return;
    }
    render(true);
  }

  function handleBlur(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.act === "link") {
      draft.link = normalizeSourceUrl(target.value);
      target.value = draft.link;
      if (attemptedSave) render();
    }
    const compact = target.dataset.act === "name" || target.dataset.act === "equipment" ||
      target.dataset.act === "link" || target.dataset.act === "cue" || target.dataset.act === "caution";
    bar.classList.toggle("compact", compact && document.activeElement === target);
  }

  function focusFirstInvalid(issues: ValidationIssue[]): void {
    const order = ["name", "duplicate", "link"] as const;
    for (const field of order) {
      if (issues.some((i) => i.field === field)) {
        if (field === "name" || field === "duplicate") {
          explicitFocusId = "ex-name";
        } else if (field === "link") {
          explicitFocusId = "ex-link";
        }
        return;
      }
    }
  }

  function handleClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) return;
    const act = target.dataset.act;
    const value = target.dataset.v;

    switch (act) {
      case "back-settings":
        commitPendingUndo();
        persist(persisted);
        onBackToSettings();
        return;
      case "back-my":
        view = "my";
        break;
      case "open-hurt":
        view = "hurt";
        break;
      case "open-edit":
        if (value) {
          editing = persisted.userExercises?.find((e) => e.id === value) ?? null;
          draft = editing ? userExerciseToDraft(editing) : emptyExerciseDraft();
          savedDraftJson = JSON.stringify(draft);
          attemptedSave = false;
          view = "form";
          const row = persisted.userExercises?.find((e) => e.id === value);
          if (row?.newUntil) {
            row.newUntil = undefined;
            persist(persisted);
          }
        }
        break;
      case "add-new":
        editing = null;
        draft = emptyExerciseDraft();
        savedDraftJson = JSON.stringify(draft);
        attemptedSave = false;
        view = "form";
        break;
      case "cat":
        if (value) {
          const idx = draft.categories.indexOf(value);
          if (idx >= 0) draft.categories.splice(idx, 1);
          else draft.categories.push(value);
        }
        break;
      case "kettlebell":
        draft.kettlebell = !draft.kettlebell;
        break;
      case "per-side":
        draft.dose.perSide = !draft.dose.perSide;
        break;
      case "where":
        draft.location =
          value === "home" ? "home" : value === "gym" ? "gym" : undefined;
        break;
      case "dose-mode":
        if (value === "hold" || value === "reps") {
          draft.dose.mode = value;
        }
        break;
      case "sets-dec":
        draft.dose.sets = clampSets(draft.dose.sets - 1);
        break;
      case "sets-inc":
        draft.dose.sets = clampSets(draft.dose.sets + 1);
        break;
      case "dose-dec":
        if (draft.dose.mode === "hold") {
          draft.dose.holdS = clampHoldSeconds((draft.dose.holdS ?? 30) - 5);
        } else {
          draft.dose.reps = clampReps((draft.dose.reps ?? 10) - 1);
        }
        break;
      case "dose-inc":
        if (draft.dose.mode === "hold") {
          draft.dose.holdS = clampHoldSeconds((draft.dose.holdS ?? 30) + 5);
        } else {
          draft.dose.reps = clampReps((draft.dose.reps ?? 10) + 1);
        }
        break;
      case "cue-add":
        draft.cues.push("");
        explicitFocusId = `cue-${draft.cues.length - 1}`;
        break;
      case "cue-remove":
        if (value) {
          const i = Number(value);
          draft.cues.splice(i, 1);
          if (!draft.cues.length) draft.cues = [""];
          explicitFocusId = `cue-${Math.max(0, i - 1)}`;
        }
        break;
      case "risk": {
        if (!value) break;
        const [conditionId, level] = value.split(":");
        if (conditionId && (level === "low" || level === "moderate" || level === "high")) {
          draft.riskChosen[conditionId] = level;
        }
        break;
      }
      case "restore": {
        commitPendingUndo();
        if (!value) break;
        const result = restoreHurtExercise(persisted.hurtExclusions ?? [], value);
        if (result.restored) {
          persisted = {
            ...persisted,
            hurtExclusions: result.exclusions,
            pendingHurtRestore: { exerciseId: value, previous: result.restored },
          };
          persist(persisted);
          explicitFocusId = `undo-restore-${value}`;
        }
        break;
      }
      case "undo-restore": {
        const pending = persisted.pendingHurtRestore;
        if (pending && value === pending.exerciseId) {
          persisted = {
            ...persisted,
            hurtExclusions: undoHurtRestore(persisted.hurtExclusions ?? [], pending),
            pendingHurtRestore: undefined,
          };
          persist(persisted);
          explicitFocusId = `restore-pill-${value}`;
        }
        break;
      }
      case "save": {
        attemptedSave = true;
        const issues = validateExerciseForm({
          draft,
          conditions: config.conditions,
          libraryExercises,
          userNames: (persisted.userExercises ?? []).map((e) => ({ id: e.id, name: e.name })),
          editingId: editing?.id,
          validateNow: true,
        });
        if (issues.length > 0) {
          focusFirstInvalid(issues);
          render();
          return;
        }
        const saved = draftToUserExercise(draft, editing, new Date());
        const list = [...(persisted.userExercises ?? [])];
        const idx = list.findIndex((e) => e.id === saved.id);
        if (idx >= 0) list[idx] = saved;
        else list.push(saved);
        persisted = { ...persisted, userExercises: list };
        persist(persisted);
        statusMessage = `Saved “${saved.name}”`;
        editing = null;
        view = "my";
        explicitFocusId = "my-title";
        break;
      }
      case "delete": {
        if (!editing) break;
        const result = deleteUserExercise(
          editing.id,
          persisted.userExercises ?? [],
          persisted.deletedExerciseHistory ?? [],
          persisted.weekSessionsRemaining ?? [],
          persisted.hurtExclusions ?? [],
          new Date(),
        );
        if (result) {
          persisted = {
            ...persisted,
            userExercises: result.userExercises,
            deletedExerciseHistory: result.deletedHistory,
            weekSessionsRemaining: result.weekSessionsRemaining,
            hurtExclusions: result.hurtExclusions,
          };
          persist(persisted);
          editing = null;
          view = "my";
        }
        break;
      }
      case "focus-field":
        event.preventDefault();
        if (value === "name" || value === "duplicate") explicitFocusId = "ex-name";
        else if (value === "link") explicitFocusId = "ex-link";
        render();
        return;
      default:
        break;
    }
    render();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" && view === "form") {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        event.preventDefault();
      }
    }
  }

  let kbOffset = 0;
  function syncKeyboardOffset(): void {
    if (!window.visualViewport) return;
    const offset = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    kbOffset = offset;
    document.documentElement.style.setProperty("--kb-offset", `${offset}px`);
    bar.classList.toggle("compact", kbOffset > 0);
  }

  document.addEventListener("input", handleInput);
  document.addEventListener("blur", handleBlur, true);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", handleKeydown);
  window.visualViewport?.addEventListener("resize", syncKeyboardOffset);
  window.visualViewport?.addEventListener("scroll", syncKeyboardOffset);

  render();

  return {
    destroy: () => {
      document.removeEventListener("input", handleInput);
      document.removeEventListener("blur", handleBlur, true);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeydown);
      window.visualViewport?.removeEventListener("resize", syncKeyboardOffset);
      window.visualViewport?.removeEventListener("scroll", syncKeyboardOffset);
      bar.remove();
      document.body.classList.remove("exercise-has-bar");
      document.documentElement.style.removeProperty("--kb-offset");
      root.innerHTML = "";
    },
  };
}