/** User-attached media on an exercise takes precedence over the routine library video. */
export function shouldShowLibraryRoutineVideo(
  routineVideo: string | undefined,
  hasUserMedia: boolean,
  context: "library-exercise" | "routine",
): boolean {
  if (!routineVideo) {
    return false;
  }
  if (context === "routine") {
    return true;
  }
  return !hasUserMedia;
}