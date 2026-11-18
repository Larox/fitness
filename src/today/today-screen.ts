import "../media/media.css";
import "./today.css";
import type { AppConfig } from "../config/types";
import { getExerciseClipOverride } from "../library/exercise-clip-store";
import { probeLibraryVideoDuration } from "../library/library-video-fetch";
import { shouldShowLibraryRoutineVideo } from "../library/library-video-visibility";
import type { NormalizedExercise, NormalizedRoutine } from "../library/types";
import { resolveExerciseVideoSegment } from "../library/video-segment";
import {
  LibraryVideoPreview,
  mountLibraryVideoPreview,
} from "../media/library-video-preview";
import { renderRoutineSourceLink } from "../library/source-link";
import { getMediaByExerciseId, loadMediaSettings } from "../media/meta-store";
import { ExerciseMediaPreview } from "../media/preview";
import type { WeekPlanRow, WeekPlanSessionResult } from "../plan/types";
import { activeConditionIds } from "../setup/defaults";
import { createConditionLabelContext } from "../setup/condition-labels";
import { escapeHtml, ICONS } from "../setup/icons";
import { mergePersistedState } from "../setup/merge";
import type { PersistedAppState } from "../setup/types";
import type { SettingsStorage } from "../setup/storage";
import { buildTodayChangeNotes } from "./change-notes";
import { normalizeCues } from "./cues";
import {
  markSessionCompleted,
  sessionCompletionSummary,
  unmarkSessionCompleted,
} from "./completion";
import { formatScheduledDose } from "./dose-label";
import { exerciseUsesKettlebell } from "./kettlebell";
import { moderateCautionBanner } from "./moderate-caution";
import {
  resolveTodayView,
  type ResolvedTodayView,
  type TodayViewMode,
} from "./resolve-today-session";
import {
  applySetMetric,
  clampSetMetric,
  renderSetLogsEditor,
  toggleSetSkipped,
} from "./set-editor";
import {
  defaultSetLogsForScheduled,
  normalizeExerciseSetLogs,
  scheduledUsesHold,
} from "./set-logs";
import {
  buildSessionDraftId,
  deleteSessionDraft,
  getSessionDraft,
  saveSessionDraft,
  type SessionDraftCardState,
} from "./session-draft-store";
import { getSessionLog, deleteSessionLog, saveSessionLog } from "./session-log-store";
import { resolveSavedSessionLogId, sessionLogId } from "./session-restore";
import type { ExerciseSessionLog, SessionLogRecord } from "./types";
import {
  formatTodayOverline,
  weekPlanDayIndex,
  weekStartForPlanRow,
  weekStartKey,
} from "./weekday";

function viewAllowsLogging(mode: TodayViewMode): boolean {
  return mode === "scheduled" || mode === "trained_early";
}

interface CardState {
  expanded: boolean;
  done: boolean;
  hurt: boolean;
  bellKg: number | null | undefined;
  setLogs: ExerciseSessionLog["sets"];
}

export interface MountTodayScreenOptions {
  config: AppConfig;
  storage: SettingsStorage;
  root: HTMLElement;
  exercisesById: ReadonlyMap<string, NormalizedExercise>;
  routineSourceById: ReadonlyMap<string, string | undefined>;
  routinesById: ReadonlyMap<string, NormalizedRoutine>;
  onOpenSettings: () => void;
  now?: () => Date;
}

export function mountTodayScreen(options: MountTodayScreenOptions): {
  destroy: () => void;
  reloadPersisted: () => void;
} {
  const { config, storage, root, exercisesById, routineSourceById, routinesById, onOpenSettings } =
    options;
  const now = options.now ?? (() => new Date());

  const bar = document.createElement("div");
  bar.className = "today-bar";
  bar.id = "today-bar";
  document.body.appendChild(bar);

  let mediaPreview: ExerciseMediaPreview | null = null;
  let libraryVideoPreview: LibraryVideoPreview | null = null;

  let persisted = mergePersistedState(storage.load(), config);
  const labels = createConditionLabelContext(config, persisted.conditionOverrides ?? {});
  const active = activeConditionIds(persisted.settings);

  let sessionSaved = false;
  let savedAt: string | null = null;
  let savedLogId: string | null = null;
  let cards: Record<string, CardState> = {};
  let draftRestored = false;
  let completionHydrated = false;
  let draftFlushScheduled = false;
  let trainEarlySessionId: string | null =
    persisted.trainEarlySessionByWeek?.[weekStartKey(now())] ?? null;

  function currentWeekStart(): string {
    return weekStartKey(now());
  }

  function sessionWeekStart(row: WeekPlanRow): string {
    return weekStartForPlanRow(now(), row.dayIndex);
  }

  function reloadPersistedFromStorage(): void {
    persisted = mergePersistedState(storage.load(), config);
    trainEarlySessionId =
      persisted.trainEarlySessionByWeek?.[currentWeekStart()] ?? trainEarlySessionId;
  }

  function flushSessionDraft(): void {
    const view = resolvedToday();
    if (!view || !viewAllowsLogging(view.mode) || sessionSaved) {
      return;
    }
    const { row, session } = view;
    const week = sessionWeekStart(row);
    const draftCards: Record<string, SessionDraftCardState> = {};
    for (const sched of session.scheduled) {
      const state = cards[sched.exerciseId];
      if (!state) {
        continue;
      }
      draftCards[sched.exerciseId] = {
        expanded: state.expanded,
        done: state.done,
        hurt: state.hurt,
        bellKg: state.bellKg,
        setLogs: state.setLogs.map((log) => ({ ...log })),
      };
    }
    void saveSessionDraft({
      id: buildSessionDraftId(week, row.sessionId),
      sessionId: row.sessionId,
      weekStart: week,
      dayIndex: row.dayIndex,
      updatedAt: now().toISOString(),
      cards: draftCards,
    });
  }

  async function hydrateSessionState(
    row: WeekPlanRow,
    session: WeekPlanSessionResult,
  ): Promise<void> {
    const week = sessionWeekStart(row);
    const existing = sessionCompletionSummary(
      persisted.completedSessions,
      row.sessionId,
      week,
    );
    if (existing) {
      sessionSaved = true;
      savedAt = existing.completedAt;
      savedLogId = await resolveSavedSessionLogId(row.sessionId, existing.completedAt);
      const log = savedLogId ? await getSessionLog(savedLogId) : null;
      if (log) {
        for (const entry of log.exercises) {
          const sched = session.scheduled.find((s) => s.exerciseId === entry.exerciseId);
          cards[entry.exerciseId] = {
            expanded: false,
            done: entry.done,
            hurt: entry.hurt,
            bellKg: entry.bellKg,
            setLogs: normalizeExerciseSetLogs(entry, sched),
          };
        }
      }
      completionHydrated = true;
      return;
    }

    const draft = await getSessionDraft(week, row.sessionId).catch(() => null);
    if (!draft) {
      return;
    }
    for (const [exerciseId, state] of Object.entries(draft.cards)) {
      cards[exerciseId] = {
        expanded: state.expanded,
        done: state.done,
        hurt: state.hurt,
        bellKg: state.bellKg,
        setLogs: state.setLogs.map((log) => ({ ...log })),
      };
    }
    draftRestored = true;
  }

  function scheduleDraftFlush(): void {
    if (draftFlushScheduled) {
      return;
    }
    draftFlushScheduled = true;
    queueMicrotask(() => {
      draftFlushScheduled = false;
      flushSessionDraft();
    });
  }

  function resolvedToday(): ResolvedTodayView | null {
    const plan = persisted.weekPlan;
    if (!plan) {
      return null;
    }
    return resolveTodayView(plan, weekPlanDayIndex(now()), {
      trainEarlySessionId,
      completedSessions: persisted.completedSessions,
      referenceDate: now(),
    });
  }

  function ensureCards(session: WeekPlanSessionResult): void {
    for (const row of session.scheduled) {
      if (!cards[row.exerciseId]) {
        const remembered = persisted.exerciseBellKg?.[row.exerciseId];
        cards[row.exerciseId] = {
          expanded: false,
          done: false,
          hurt: false,
          bellKg: remembered,
          setLogs: defaultSetLogsForScheduled(row),
        };
      }
    }
    const firstOpen = session.scheduled.find(
      (row) => !cards[row.exerciseId]?.done && !cards[row.exerciseId]?.hurt,
    );
    if (firstOpen && !sessionSaved && !draftRestored && !completionHydrated) {
      cards[firstOpen.exerciseId]!.expanded = true;
    }
  }

  function bellChoices(location: "home" | "gym" | null): number[] {
    if (location === "gym") {
      return [...persisted.settings.gymBellsKg].sort((a, b) => a - b);
    }
    return [...persisted.settings.homeBellsKg].sort((a, b) => a - b);
  }

  function renderBar(canSave: boolean, helper: string, buttonLabel: string): void {
    if (sessionSaved) {
      bar.innerHTML = `<div class="in" role="status"><p class="help">Session saved</p><button type="button" class="link" data-act="today-undo">Undo</button></div>`;
      return;
    }
    bar.innerHTML = `<div class="in"><p class="help" aria-live="polite">${escapeHtml(helper)}</p>
      <button type="button" class="primary" data-act="today-save" ${canSave ? "" : "disabled"}>${escapeHtml(buttonLabel)}</button></div>`;
  }

  function renderExerciseCard(
    sched: WeekPlanSessionResult["scheduled"][number],
    row: WeekPlanRow,
    interactionsDisabled = false,
  ): string {
    const exercise = exercisesById.get(sched.exerciseId);
    const state = cards[sched.exerciseId]!;
    const swapped = sched.sourceExerciseId !== sched.exerciseId;
    const dose = formatScheduledDose(sched);
    const caution =
      !state.done && !state.hurt && exercise
        ? moderateCautionBanner(exercise, config.conditions, active, labels.conditionLabel)
        : null;
    const doseLine = state.done
      ? '<span class="edose done-txt">Done</span>'
      : state.hurt
        ? '<span class="edose stop-txt">Stopped</span>'
        : `<span class="edose">${escapeHtml(dose)}${swapped ? ' <span class="muted">swapped in</span>' : ""}</span>`;

    const cautionHtml =
      caution && !state.done && !state.hurt
        ? `<div class="tcaution" role="note"><b>${escapeHtml(caution.labelLine)}</b>${escapeHtml(caution.body)}</div>`
        : "";

    const cues =
      exercise && state.expanded
        ? `<ul class="tcues">${normalizeCues(exercise.cues)
            .map((c) => `<li>${escapeHtml(c)}</li>`)
            .join("")}</ul>`
        : "";

    const bellHtml =
      exercise && state.expanded && exerciseUsesKettlebell(exercise)
        ? (() => {
            const choices = bellChoices(row.location);
            const chips = [
              `<button type="button" class="tchip" role="radio" aria-checked="${state.bellKg === null ? "true" : "false"}" data-act="today-bell" data-id="${sched.exerciseId}" data-v="none">No bell</button>`,
              ...choices.map(
                (kg) =>
                  `<button type="button" class="tchip" role="radio" aria-checked="${state.bellKg === kg ? "true" : "false"}" data-act="today-bell" data-id="${sched.exerciseId}" data-v="${kg}">${kg} kg</button>`,
              ),
            ];
            return `<div class="tbell"><p class="blabel">Bell used</p><div class="tchips" role="radiogroup" aria-label="Bell used for ${escapeHtml(exercise.name)}">${chips.join("")}</div></div>`;
          })()
        : "";

    const setEditor =
      state.expanded && exercise
        ? renderSetLogsEditor(
            sched.exerciseId,
            exercise.name,
            sched,
            state.setLogs,
            sessionSaved || interactionsDisabled,
          )
        : "";

    const body =
      state.expanded && exercise
        ? `<div class="tbody" id="today-body-${sched.exerciseId}"><div class="today-media-slot" id="today-media-${sched.exerciseId}"></div>${setEditor}${cues}${bellHtml}<div class="tfoot"><span class="source-slot">${renderRoutineSourceLink(routineSourceById.get(exercise.routineId))}</span>
          <button type="button" class="thurt" aria-pressed="${state.hurt ? "true" : "false"}" data-act="today-hurt" data-id="${sched.exerciseId}">This hurt</button></div></div>`
        : "";

    return `<article class="tcard${state.done ? " is-done" : ""}" data-eid="${sched.exerciseId}">
      <div class="trow">
        <button type="button" class="tcheck" aria-pressed="${state.done ? "true" : "false"}" aria-label="Done: ${escapeHtml(exercise?.name ?? sched.exerciseId)}" data-act="today-done" data-id="${sched.exerciseId}" ${sessionSaved || interactionsDisabled ? "disabled" : ""}><span class="ring">${ICONS.ck}</span></button>
        <button type="button" class="thead" aria-expanded="${state.expanded ? "true" : "false"}" data-act="today-expand" data-id="${sched.exerciseId}">
          <span><span class="ename">${escapeHtml(exercise?.name ?? sched.exerciseId)}</span>${doseLine}</span>
          <span aria-hidden="true">${ICONS.chev}</span>
        </button>
      </div>
      ${cautionHtml}
      ${body}
    </article>`;
  }

  async function mountExpandedMedia(exerciseId: string): Promise<void> {
    mediaPreview?.destroy();
    mediaPreview = null;
    libraryVideoPreview?.destroy();
    libraryVideoPreview = null;
    const host = root.querySelector<HTMLElement>(`#today-media-${exerciseId}`);
    const exercise = exercisesById.get(exerciseId);
    if (!host || !exercise) {
      return;
    }
    const meta = await getMediaByExerciseId(exerciseId);
    if (!meta) {
      const routine = routinesById.get(exercise.routineId);
      if (
        !routine?.video ||
        !shouldShowLibraryRoutineVideo(routine.video, false, "library-exercise")
      ) {
        return;
      }
      const fullDurationS = await probeLibraryVideoDuration(routine.video);
      if (fullDurationS === null) {
        return;
      }
      const override = await getExerciseClipOverride(exerciseId);
      const segment = resolveExerciseVideoSegment(
        { startS: exercise.libraryClipStartS, endS: exercise.libraryClipEndS },
        override
          ? { startS: override.clipStartS, endS: override.clipEndS }
          : undefined,
        fullDurationS,
      );
      const slot = document.createElement("div");
      host.insertBefore(slot, host.firstChild);
      const reducedMotion =
        typeof matchMedia === "function" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      libraryVideoPreview = await mountLibraryVideoPreview({
        root: slot,
        relativePath: routine.video,
        ariaLabel: `Routine preview for ${exercise.name}`,
        segment,
        reducedMotion,
      });
      return;
    }
    const settings = await loadMediaSettings();
    const slot = document.createElement("div");
    host.insertBefore(slot, host.firstChild);
    mediaPreview = new ExerciseMediaPreview({
      root: slot,
      exerciseName: exercise.name,
      meta,
      todayView: settings.todayMediaView?.[exerciseId] ?? "anim",
    });
    const state = await mediaPreview.load();
    mediaPreview.render(state);
  }

  function countProgress(session: WeekPlanSessionResult): {
    done: number;
    hurt: number;
    total: number;
  } {
    let done = 0;
    let hurt = 0;
    for (const row of session.scheduled) {
      const state = cards[row.exerciseId];
      if (!state) {
        continue;
      }
      if (state.done) {
        done += 1;
      } else if (state.hurt) {
        hurt += 1;
      }
    }
    return { done, hurt, total: session.scheduled.length };
  }

  function render(): void {
    root.className = "today-shell";
    const view = resolvedToday();

    if (!view) {
      root.innerHTML = `<header class="hdr"><p class="overline">Today</p><h1 class="title">No plan yet</h1><p class="meta">Open settings if this does not load.</p></header>
        <button type="button" class="today-settings-link" data-act="today-settings">Open settings</button>`;
      bar.innerHTML = "";
      return;
    }

    const { row, session, mode } = view;
    const canLog = viewAllowsLogging(mode);
    const isPreview = mode === "preview";

    ensureCards(session);
    const progress = countProgress(session);
    const segs = session.scheduled
      .map((sched) => {
        const state = cards[sched.exerciseId]!;
        const cls = state.done ? "d" : state.hurt ? "h" : "";
        return `<i class="${cls}"></i>`;
      })
      .join("");

    const isRest = row.slotKind === "rest" && !isPreview && mode !== "trained_early";
    const locationTag =
      row.location === null
        ? isRest
          ? '<span class="tag rest-tag">Optional</span>'
          : ""
        : `<span class="tag">${row.location === "home" ? "Home" : "Gym"}</span>`;

    const previewIntro = isPreview
      ? `<section class="restcard"><p><b>Rest day.</b> Your next session is planned for <b>${escapeHtml(view.scheduledDayLabel ?? row.dayLabel)}</b>. You can train it today if you want.</p></section>`
      : mode === "trained_early"
        ? `<section class="restcard"><p><b>Training early.</b> This session was planned for <b>${escapeHtml(row.dayLabel)}</b>.</p></section>`
        : "";

    const changeNotes =
      sessionSaved || session.dropped.length === 0
        ? ""
        : buildTodayChangeNotes(
            session.scheduled,
            session.dropped,
            exercisesById,
            config.conditions,
            labels.conditionLabel,
          )
            .map((n) => n.html)
            .join("");

    const completionBanner =
      sessionSaved && savedAt
        ? `<div class="donecard" role="status"><span class="ic">${ICONS.ck}</span><div><b>${isRest ? "Mobility done" : "Session done"}</b><span>Saved on this phone · ${escapeHtml(new Date(savedAt).toLocaleString())}</span></div></div>`
        : "";

    const restIntro = isRest
      ? `<section class="restcard"><p><b>Rest is part of the plan.</b> If you feel like moving, here are easy minutes. Skipping is fine.</p></section>`
      : "";

    const list = session.scheduled
      .map((sched) => renderExerciseCard(sched, row, !canLog || sessionSaved))
      .join("");
    const partial = progress.done > 0 && progress.done + progress.hurt < progress.total;
    const canSave = canLog && progress.done > 0 && !sessionSaved;
    const helper = isPreview
      ? "Previewing your next session."
      : progress.done === 0
        ? isRest
          ? "Optional. Tick a move if you do it."
          : "Tick off an exercise to finish."
        : partial
          ? `${progress.done} of ${progress.total} done · finish now and it saves as partial`
          : progress.hurt > 0
            ? `${progress.done} done · ${progress.hurt} stopped`
            : "All done. Nice work.";

    const saveLabel = isPreview
      ? "Train it today"
      : isRest
        ? "Mark mobility done"
        : "Mark session done";

    const plannedMeta = isPreview
      ? `<span class="tag rest-tag">Planned · ${escapeHtml(view.scheduledDayLabel ?? row.dayLabel)}</span>`
      : "";

    root.innerHTML = `<header class="hdr"><div class="hdr-top"><p class="overline">${escapeHtml(formatTodayOverline(now()))}</p>
      <button type="button" class="today-settings-link" data-act="today-settings">Settings</button></div>
      <h1 class="title" tabindex="-1">${escapeHtml(row.title)}</h1>
      <p class="meta">${plannedMeta}${locationTag}<span>≈ ${row.minutes} min</span>${!isRest ? `<span class="dot">·</span><span>${session.scheduled.length} exercises</span>` : `<span>· optional mobility</span>`}</p>
      ${!isRest && canLog ? `<div class="prog" aria-label="Session progress"><span class="segs">${segs}</span><b>${progress.done} of ${progress.total} done</b></div>` : ""}
    </header>
    ${completionBanner}
    ${changeNotes}
    ${previewIntro}
    ${restIntro}
    <div class="list">${list}</div>`;

    if (isPreview) {
      bar.innerHTML = `<div class="in"><p class="help" aria-live="polite">${escapeHtml(helper)}</p>
        <button type="button" class="primary" data-act="today-train-early">Train it today</button></div>`;
    } else {
      renderBar(canSave, helper, saveLabel);
    }

    const expanded = session.scheduled.find((s) => cards[s.exerciseId]?.expanded);
    if (expanded) {
      void mountExpandedMedia(expanded.exerciseId);
    }
  }

  function persist(merge: (fresh: PersistedAppState) => PersistedAppState): void {
    const fresh = mergePersistedState(storage.load(), config);
    persisted = merge(fresh);
    storage.save(persisted);
  }

  function openNextUnresolved(currentId: string, session: WeekPlanSessionResult): void {
    for (const row of session.scheduled) {
      cards[row.exerciseId] ??= {
        expanded: false,
        done: false,
        hurt: false,
        bellKg: persisted.exerciseBellKg?.[row.exerciseId],
        setLogs: defaultSetLogsForScheduled(row),
      };
      cards[row.exerciseId]!.expanded = false;
    }
    const next = session.scheduled.find((row) => {
      if (row.exerciseId === currentId) {
        return false;
      }
      const state = cards[row.exerciseId]!;
      return !state.done && !state.hurt;
    });
    if (next) {
      cards[next.exerciseId]!.expanded = true;
    }
  }

  function buildSessionLog(
    row: WeekPlanRow,
    session: WeekPlanSessionResult,
    completedAt: string,
    partial: boolean,
  ): SessionLogRecord {
    const exercises: ExerciseSessionLog[] = [];
    for (const sched of session.scheduled) {
      const state = cards[sched.exerciseId];
      if (!state) {
        continue;
      }
      if (!state.done && !state.hurt) {
        continue;
      }
      exercises.push({
        exerciseId: sched.exerciseId,
        sourceExerciseId: sched.sourceExerciseId,
        done: state.done,
        hurt: state.hurt,
        bellKg: state.bellKg ?? null,
        sets: state.done ? state.setLogs.map((row) => ({ ...row })) : [],
      });
    }
    return {
      id: sessionLogId(row.sessionId, completedAt),
      sessionId: row.sessionId,
      dayIndex: row.dayIndex,
      completedAt,
      partial,
      location: row.location,
      title: row.title,
      exercises,
    };
  }

  function handleClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!target) {
      return;
    }
    const act = target.dataset.act;

    if (act === "today-settings") {
      onOpenSettings();
      return;
    }

    if (act === "today-train-early") {
      const view = resolvedToday();
      if (view?.mode === "preview") {
        trainEarlySessionId = view.row.sessionId;
        const sessionId = view.row.sessionId;
        const session = view.session;
        cards = {};
        draftRestored = false;
        completionHydrated = false;
        sessionSaved = false;
        const viewerWeek = currentWeekStart();
        persist((fresh) => ({
          ...fresh,
          trainEarlySessionByWeek: {
            ...(fresh.trainEarlySessionByWeek ?? {}),
            [viewerWeek]: sessionId,
          },
        }));
        void hydrateSessionState(view.row, session).then(() => render());
        render();
      }
      return;
    }

    const view = resolvedToday();
    if (!view || !viewAllowsLogging(view.mode)) {
      return;
    }
    const session = view.session;
    const row = view.row;

    const exerciseId = target.dataset.id;

    switch (act) {
      case "today-expand":
        if (!exerciseId) {
          break;
        }
        for (const sched of session.scheduled) {
          cards[sched.exerciseId]!.expanded = sched.exerciseId === exerciseId;
        }
        render();
        scheduleDraftFlush();
        break;
      case "today-done":
        if (!exerciseId || sessionSaved) {
          break;
        }
        cards[exerciseId]!.done = !cards[exerciseId]!.done;
        if (cards[exerciseId]!.done) {
          cards[exerciseId]!.hurt = false;
          cards[exerciseId]!.expanded = false;
          openNextUnresolved(exerciseId, session);
        }
        render();
        scheduleDraftFlush();
        break;
      case "today-hurt":
        if (!exerciseId) {
          break;
        }
        cards[exerciseId]!.hurt = !cards[exerciseId]!.hurt;
        if (cards[exerciseId]!.hurt) {
          const exclusions = [...(persisted.hurtExclusions ?? [])];
          if (!exclusions.some((e) => e.exerciseId === exerciseId)) {
            exclusions.push({
              exerciseId,
              markedAt: now().toISOString(),
              from: "today",
            });
            persist((fresh) => ({ ...fresh, hurtExclusions: exclusions }));
          }
          if (!cards[exerciseId]!.done) {
            cards[exerciseId]!.expanded = false;
            openNextUnresolved(exerciseId, session);
          }
        }
        render();
        scheduleDraftFlush();
        break;
      case "today-bell":
        if (!exerciseId || sessionSaved) {
          break;
        }
        {
          const value = target.dataset.v;
          const kg = value === "none" ? null : Number(value);
          cards[exerciseId]!.bellKg = kg;
          const bells = { ...(persisted.exerciseBellKg ?? {}) };
          bells[exerciseId] = kg;
          persist((fresh) => ({ ...fresh, exerciseBellKg: bells }));
          render();
          scheduleDraftFlush();
        }
        break;
      case "today-set-inc":
      case "today-set-dec": {
        if (!exerciseId || sessionSaved) {
          break;
        }
        const schedRow = session.scheduled.find((row) => row.exerciseId === exerciseId);
        const setIndex = Number(target.dataset.idx);
        const card = cards[exerciseId];
        if (!schedRow || !card || !Number.isFinite(setIndex)) {
          break;
        }
        const hold = scheduledUsesHold(schedRow);
        const current = card.setLogs[setIndex];
        if (!current || current.status === "skipped") {
          break;
        }
        const metric = hold
          ? (current.holdS ?? schedRow.hold_s ?? 30)
          : (current.reps ?? 10);
        const delta = act === "today-set-inc" ? 1 : -1;
        card.setLogs = applySetMetric(card.setLogs, setIndex, schedRow, metric + delta);
        render();
        scheduleDraftFlush();
        break;
      }
      case "today-set-skip": {
        if (!exerciseId || sessionSaved) {
          break;
        }
        const setIndex = Number(target.dataset.idx);
        const card = cards[exerciseId];
        if (!card || !Number.isFinite(setIndex)) {
          break;
        }
        card.setLogs = toggleSetSkipped(card.setLogs, setIndex);
        render();
        scheduleDraftFlush();
        break;
      }
      case "today-save": {
        const progress = countProgress(session);
        if (progress.done === 0) {
          break;
        }
        const completedAt = now().toISOString();
        const partial = progress.done + progress.hurt < progress.total;
        const log = buildSessionLog(row, session, completedAt, partial);
        savedLogId = log.id;
        sessionSaved = true;
        savedAt = completedAt;
        void saveSessionLog(log);
        const week = sessionWeekStart(row);
        void deleteSessionDraft(buildSessionDraftId(week, row.sessionId));
        const viewerWeek = currentWeekStart();
        persist((fresh) => {
          let next = markSessionCompleted(fresh, row.sessionId, week, { completedAt, partial });
          if (next.trainEarlySessionByWeek?.[viewerWeek] === row.sessionId) {
            const trainEarly = { ...next.trainEarlySessionByWeek };
            delete trainEarly[viewerWeek];
            next = {
              ...next,
              trainEarlySessionByWeek:
                Object.keys(trainEarly).length > 0 ? trainEarly : undefined,
            };
            trainEarlySessionId = null;
          }
          return next;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        render();
        break;
      }
      case "today-undo": {
        if (savedLogId) {
          void deleteSessionLog(savedLogId);
        }
        sessionSaved = false;
        savedAt = null;
        savedLogId = null;
        persist((fresh) =>
          unmarkSessionCompleted(fresh, row.sessionId, sessionWeekStart(row)),
        );
        render();
        break;
      }
      default:
        break;
    }
  }

  function handleInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("tset-in")) {
      return;
    }
    if (sessionSaved) {
      return;
    }
    const view = resolvedToday();
    if (!view || !viewAllowsLogging(view.mode)) {
      return;
    }
    const session = view.session;
    const exerciseId = target.dataset.id;
    const setIndex = Number(target.dataset.idx);
    const card = exerciseId ? cards[exerciseId] : undefined;
    const schedRow = exerciseId
      ? session.scheduled.find((row) => row.exerciseId === exerciseId)
      : undefined;
    if (!exerciseId || !card || !schedRow || !Number.isFinite(setIndex)) {
      return;
    }
    const current = card.setLogs[setIndex];
    if (!current || current.status === "skipped") {
      return;
    }
    card.setLogs = applySetMetric(
      card.setLogs,
      setIndex,
      schedRow,
      clampSetMetric(Number(target.value), scheduledUsesHold(schedRow)),
    );
    scheduleDraftFlush();
  }

  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  void (async () => {
    const view = resolvedToday();
    if (view && viewAllowsLogging(view.mode)) {
      await hydrateSessionState(view.row, view.session);
    }
    render();
  })();

  return {
    reloadPersisted: reloadPersistedFromStorage,
    destroy: () => {
      flushSessionDraft();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("input", handleInput);
      mediaPreview?.destroy();
      libraryVideoPreview?.destroy();
      bar.remove();
      root.innerHTML = "";
      root.className = "";
    },
  };
}