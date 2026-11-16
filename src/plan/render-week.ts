import { escapeHtml, ICONS } from "../setup/icons";
import type { PersistedAppState } from "../setup/types";
import { isSessionCompleted } from "../today/completion";
import type { WeekPlan } from "./types";

export function renderThisWeekList(
  plan: WeekPlan,
  completedSessions: PersistedAppState["completedSessions"],
  weekStart: string,
): string {
  const rows = plan.rows
    .map((row) => {
      const done = isSessionCompleted(completedSessions, row.sessionId, weekStart);
      const caution =
        !done && row.hasCaution
          ? `<span class="pcaution" aria-label="Caution before session">${ICONS.warn}</span>`
          : "";
      const doneBadge = done
        ? `<span class="pdone" aria-label="Session done">${ICONS.ck}</span>`
        : "";
      const locationTag =
        row.location === null
          ? ""
          : `<span class="ptag">${row.location === "home" ? "Home" : "Gym"}</span>`;
      const subtitle =
        row.slotKind === "rest"
          ? `Optional mobility · ${row.minutes} min${done ? " · Done" : ""}`
          : `${row.minutes} min${done ? " · Done" : ""}`;
      return `<button type="button" class="prow${done ? " prow-done" : ""}" disabled aria-disabled="true">
        <span class="pday">${escapeHtml(row.dayLabel)}</span>
        <span class="ptxt">
          <span class="ptitle">${escapeHtml(row.title)}</span>
          <span class="pmeta">${escapeHtml(subtitle)}${locationTag ? ` · ${locationTag}` : ""}</span>
        </span>
        ${caution}
        ${doneBadge}
      </button>`;
    })
    .join("");
  return `<div class="sect"><h2>This week</h2></div><div class="group">${rows}</div>`;
}