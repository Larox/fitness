import type { AppConfig } from "../config/types";
import type { PersistedAppState } from "./types";

export function needsDisclaimerAcknowledgement(
  state: PersistedAppState,
  config: AppConfig,
): boolean {
  if (state.disclaimerAcknowledgedVersion === undefined) {
    return true;
  }
  return state.disclaimerAcknowledgedVersion < config.disclaimerVersion;
}

export function acknowledgeDisclaimer(
  state: PersistedAppState,
  config: AppConfig,
  at: Date,
): PersistedAppState {
  return {
    ...state,
    disclaimerAcknowledgedVersion: config.disclaimerVersion,
    disclaimerAckAt: at.toISOString(),
  };
}

export function formatAcknowledgedDate(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}