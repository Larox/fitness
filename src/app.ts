import "./exercises/exercise.css";
import { fetchAppConfig } from "./config/fetch-config";
import { mountExerciseFlow } from "./exercises/exercise-screen";
import { mergeExercisesById } from "./exercises/planning";
import { fetchImportedLibrary } from "./library/fetch-library";
import type { PlanBuildContext } from "./plan/apply-settings-save";
import { ensureWeekPlan } from "./plan/ensure-week-plan";
import { mountDisclaimerGate } from "./setup/disclaimer-gate";
import { acknowledgeDisclaimer, needsDisclaimerAcknowledgement } from "./setup/disclaimer";
import { createConditionLabelContext } from "./setup/condition-labels";
import { mergePersistedState } from "./setup/merge";
import { renderConfigError, mountSetupScreen } from "./setup/setup-screen";
import { createLocalStorageAdapter } from "./setup/storage";
import { purgeOrphanExerciseMedia } from "./media/service";
import { resumePoseJobMarker } from "./pose/pose-job-service";
import { mountTodayScreen } from "./today/today-screen";

export async function bootApp(root: HTMLElement): Promise<void> {
  const loaded = await fetchAppConfig();
  if ("errors" in loaded) {
    renderConfigError(root, loaded.errors);
    return;
  }
  const config = loaded.config;
  const libraryResult = await fetchImportedLibrary(config);
  if (!libraryResult.ok) {
    renderConfigError(root, libraryResult.errors);
    return;
  }
  const library = libraryResult.result;

  const validExerciseIds = new Set<string>([
    ...library.exercises.map((exercise) => exercise.id),
    ...(mergePersistedState(createLocalStorageAdapter().load(), config).userExercises ?? []).map(
      (row) => row.id,
    ),
  ]);
  void purgeOrphanExerciseMedia(validExerciseIds);
  void resumePoseJobMarker();

  const storage = createLocalStorageAdapter();
  let setupMount: ReturnType<typeof mountSetupScreen> | null = null;
  let exerciseMount: ReturnType<typeof mountExerciseFlow> | null = null;
  let todayMount: ReturnType<typeof mountTodayScreen> | null = null;
  let disclaimerGate: ReturnType<typeof mountDisclaimerGate> | null = null;

  const routineSourceById = new Map(
    library.routines.map((routine) => [routine.id, routine.source] as const),
  );
  const routinesById = new Map(library.routines.map((routine) => [routine.id, routine] as const));

  const persistedCounts = () => {
    const state = mergePersistedState(storage.load(), config);
    return {
      my: state.userExercises?.length ?? 0,
      hurt: state.hurtExclusions?.length ?? 0,
    };
  };

  function getPlanContext(): PlanBuildContext {
    const persisted = mergePersistedState(storage.load(), config);
    const exercisesById = mergeExercisesById(
      library.exercises,
      persisted.userExercises ?? [],
      config.conditions,
    );
    const excludedExerciseIds = new Set(
      (persisted.hurtExclusions ?? []).map((row) => row.exerciseId),
    );
    const routineNotesById = new Map(
      library.routines.map((routine) => [routine.id, routine.notes]),
    );
    const labels = createConditionLabelContext(config, persisted.conditionOverrides ?? {});
    return {
      conditions: config.conditions,
      routines: library.routines,
      exercisesById,
      excludedExerciseIds,
      routineNotesById,
      conditionLabel: labels.conditionLabel,
    };
  }

  function exercisesById() {
    const persisted = mergePersistedState(storage.load(), config);
    return mergeExercisesById(
      library.exercises,
      persisted.userExercises ?? [],
      config.conditions,
    );
  }

  function syncedPersisted(): ReturnType<typeof mergePersistedState> {
    const merged = mergePersistedState(storage.load(), config);
    const withPlan = ensureWeekPlan(merged, getPlanContext());
    if (!merged.weekPlan && withPlan.weekPlan) {
      storage.save(withPlan);
    }
    return withPlan;
  }

  function showToday(): void {
    setupMount?.destroy();
    setupMount = null;
    exerciseMount?.destroy();
    exerciseMount = null;
    disclaimerGate?.destroy();
    disclaimerGate = null;
    document.getElementById("setup-bar")?.remove();
    document.getElementById("setup-layer")?.remove();
    syncedPersisted();
    todayMount = mountTodayScreen({
      config,
      storage,
      root,
      exercisesById: exercisesById(),
      routineSourceById,
      routinesById,
      onOpenSettings: () => showSetup(),
    });
    const persisted = mergePersistedState(storage.load(), config);
    if (needsDisclaimerAcknowledgement(persisted, config)) {
      disclaimerGate = mountDisclaimerGate({
        config,
        onAcknowledge: () => {
          const current = mergePersistedState(storage.load(), config);
          let next = acknowledgeDisclaimer(current, config, new Date());
          next = ensureWeekPlan(next, getPlanContext());
          storage.save(next);
          todayMount?.reloadPersisted();
          disclaimerGate?.destroy();
          disclaimerGate = null;
          root.querySelector<HTMLElement>(".title")?.focus();
        },
      });
    }
  }

  function showSetup(): void {
    todayMount?.destroy();
    todayMount = null;
    exerciseMount?.destroy();
    exerciseMount = null;
    const counts = persistedCounts();
    setupMount = mountSetupScreen({
      config,
      storage,
      root,
      myExerciseCount: counts.my,
      hurtExerciseCount: counts.hurt,
      onOpenMyExercises: () => showExercises("my"),
      onOpenHurtList: () => showExercises("hurt"),
      onBackToToday: () => showToday(),
      onSaved: (state) => {
        if (state.setupComplete && state.weekPlan) {
          showToday();
        }
      },
      getPlanContext,
    });
  }

  function showExercises(view: "my" | "hurt", editId?: string): void {
    setupMount?.destroy();
    setupMount = null;
    todayMount?.destroy();
    todayMount = null;
    document.getElementById("setup-bar")?.remove();
    document.getElementById("setup-layer")?.remove();
    document.getElementById("today-bar")?.remove();
    exerciseMount = mountExerciseFlow({
      config,
      storage,
      root,
      libraryExercises: library.exercises,
      libraryRoutines: library.routines,
      initialView: view,
      editId,
      onBackToSettings: () => {
        const persisted = mergePersistedState(storage.load(), config);
        if (persisted.weekPlan) {
          showToday();
        } else {
          showSetup();
        }
      },
    });
  }

  syncedPersisted();
  showToday();
}