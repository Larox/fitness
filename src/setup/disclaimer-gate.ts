import type { AppConfig } from "../config/types";
import { escapeHtml, ICONS } from "./icons";

export interface MountDisclaimerGateOptions {
  config: AppConfig;
  onAcknowledge: () => void;
}

export function mountDisclaimerGate(options: MountDisclaimerGateOptions): {
  destroy: () => void;
} {
  const { config, onAcknowledge } = options;
  const layer = document.createElement("div");
  layer.id = "setup-layer";

  const contact = config.disclaimerContact
    ? escapeHtml(config.disclaimerContact)
    : "your clinician";

  layer.innerHTML = `<div class="scrim"><div class="sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="setup-disclaimer-title">
    <div class="ic">${ICONS.shield}</div>
    <h2 id="setup-disclaimer-title">Not medical advice</h2>
    <p>This app plans workouts from the exercises in your library. It is not a doctor or a physiotherapist, and it can't tell whether an exercise is right for you.</p>
    <ul><li>Cautions and swaps follow fixed rules, not a medical assessment.</li><li>Stop any exercise that hurts and tap “This hurt”.</li></ul>
    <div class="contact">Check with <b>${contact}</b> before you start.</div>
    <button class="primary" type="button" data-act="ack-disclaimer">I understand</button>
    <p class="ack">Shown once. You can read it again in Settings.</p>
  </div></div>`;

  document.body.appendChild(layer);
  document.body.classList.add("setup-locked");
  const app = document.getElementById("app");
  app?.setAttribute("inert", "");
  document.getElementById("today-bar")?.setAttribute("inert", "");

  const sheet = layer.querySelector<HTMLElement>(".sheet");
  sheet?.focus();

  function handleClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (target?.dataset.act === "ack-disclaimer") {
      onAcknowledge();
    }
  }

  document.addEventListener("click", handleClick);

  return {
    destroy: () => {
      document.removeEventListener("click", handleClick);
      layer.remove();
      document.body.classList.remove("setup-locked");
      app?.removeAttribute("inert");
      document.getElementById("today-bar")?.removeAttribute("inert");
    },
  };
}