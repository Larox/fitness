import "./exercises/exercise.css";
import { fetchAppConfig } from "./config/fetch-config";
import { mountExerciseFlow } from "./exercises/exercise-screen";
import { fetchImportedLibrary } from "./library/fetch-library";
import { mergePersistedState } from "./setup/merge";
import { renderConfigError, mountSetupScreen } from "./setup/setup-screen";
import { createLocalStorageAdapter } from "./setup/storage";

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

  const storage = createLocalStorageAdapter();
  let setupMount: ReturnType<typeof mountSetupScreen> | null = null;
  let exerciseMount: ReturnType<typeof mountExerciseFlow> | null = null;

  const persistedCounts = () => {
    const state = mergePersistedState(storage.load(), config);
    return {
      my: state.userExercises?.length ?? 0,
      hurt: state.hurtExclusions?.length ?? 0,
    };
  };

  function showSetup(): void {
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
    });
  }

  function showExercises(
    view: "my" | "hurt",
    editId?: string,
  ): void {
    setupMount?.destroy();
    setupMount = null;
    document.getElementById("setup-bar")?.remove();
    document.getElementById("setup-layer")?.remove();
    exerciseMount = mountExerciseFlow({
      config,
      storage,
      root,
      libraryExercises: library.exercises,
      libraryRoutines: library.routines,
      initialView: view,
      editId,
      onBackToSettings: () => showSetup(),
    });
  }

  showSetup();
}