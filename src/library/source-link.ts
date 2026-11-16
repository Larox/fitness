import { escapeHtml } from "../setup/icons";

function escapeAttr(text: string): string {
  return text.replaceAll('"', "&quot;");
}

/** External source link for a library routine (when `source` is a full URL). */
export function renderRoutineSourceLink(source: string | undefined): string {
  if (!source?.trim()) {
    return "";
  }
  const trimmed = source.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    let host = trimmed;
    try {
      host = new URL(trimmed).hostname;
    } catch {
      /* keep full string */
    }
    return `<p class="source-link"><a href="${escapeAttr(trimmed)}" target="_blank" rel="noopener noreferrer">Watch on ${escapeHtml(host)}</a></p>`;
  }
  return `<p class="source-link"><span class="ds">Source: ${escapeHtml(trimmed)}</span></p>`;
}