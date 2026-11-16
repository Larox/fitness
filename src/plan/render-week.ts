import { escapeHtml, ICONS } from "../setup/icons";
import type { WeekPlan } from "./types";

export function renderThisWeekList(plan: WeekPlan): string {
  const rows = plan.rows
    .map((row) => {
      const caution = row.hasCaution
        ? `<span class="pcaution" aria-label="Caution before session">${ICONS.warn}</span>`
        : "";
      const locationTag =
        row.location === null
          ? ""
          : `<span class="ptag">${row.location === "home" ? "Home" : "Gym"}</span>`;
      const subtitle =
        row.slotKind === "rest"
          ? `Optional mobility · ${row.minutes} min`
          : `${row.minutes} min`;
      return `<button type="button" class="prow" disabled aria-disabled="true">
        <span class="pday">${escapeHtml(row.dayLabel)}</span>
        <span class="ptxt">
          <span class="ptitle">${escapeHtml(row.title)}</span>
          <span class="pmeta">${escapeHtml(subtitle)}${locationTag ? ` · ${locationTag}` : ""}</span>
        </span>
        ${caution}
      </button>`;
    })
    .join("");
  return `<div class="sect"><h2>This week</h2></div><div class="group">${rows}</div>`;
}