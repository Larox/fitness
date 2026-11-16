export function normalizeCues(cues: string[]): string[] {
  if (cues.length === 0) {
    return [];
  }
  const items: string[] = [];
  for (const cue of cues) {
    const parts = cue.split(/;\s*/);
    for (let part of parts) {
      part = part.trim();
      if (!part) {
        continue;
      }
      part = part.charAt(0).toUpperCase() + part.slice(1);
      items.push(part);
    }
  }
  return items;
}