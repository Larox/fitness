/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { AppConfig } from "../src/config/types";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { initialPersistedState } from "../src/setup/defaults";
import { mountSetupScreen } from "../src/setup/setup-screen";
import { createMemoryStorage } from "../src/setup/storage";

function minimalConfig(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: [
      {
        id: "concern_a",
        label: "Concern A",
        description: "Example caution.",
        libraryField: "concern_a_risk",
      },
    ],
    equipment: {
      availableBellsKg: [6, 8],
      home: { bellsKg: [6] },
      gym: { bellsKg: [8] },
    },
  };
}

function ackedStorage(config: AppConfig) {
  const storage = createMemoryStorage();
  let state = initialPersistedState(config);
  state = acknowledgeDisclaimer(state, config, new Date("2026-11-16T12:00:00.000Z"));
  storage.save(state);
  return storage;
}

describe("setup screen focus", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps focus on the control that triggered a rebuild", () => {
    const config = minimalConfig();
    mountSetupScreen({ config, storage: ackedStorage(config), root });

    const dayFour = root.querySelector<HTMLButtonElement>(
      '[data-act="days"][data-v="4"]',
    );
    expect(dayFour).not.toBeNull();
    dayFour!.focus();
    expect(document.activeElement).toBe(dayFour);

    dayFour!.click();

    const dayFive = root.querySelector<HTMLButtonElement>(
      '[data-act="days"][data-v="5"]',
    );
    dayFive!.focus();
    expect(document.activeElement).toBe(dayFive);
    dayFive!.click();

    const focused = document.activeElement as HTMLElement;
    expect(focused?.dataset.act).toBe("days");
    expect(focused?.dataset.v).toBe("5");
    expect(document.activeElement).not.toBe(document.body);
  });

  it("returns focus to the disclaimer row when the read-only sheet closes", () => {
    const config = minimalConfig();
    mountSetupScreen({ config, storage: ackedStorage(config), root });

    const disclaimerRow = root.querySelector<HTMLButtonElement>(
      '[data-act="open-disclaimer"]',
    );
    expect(disclaimerRow).not.toBeNull();
    disclaimerRow!.focus();
    disclaimerRow!.click();

    const close = document.querySelector<HTMLButtonElement>(
      '[data-act="close-disclaimer"]',
    );
    expect(close).not.toBeNull();
    close!.click();

    const rowAfter = root.querySelector<HTMLButtonElement>(
      '[data-act="open-disclaimer"]',
    );
    expect(document.activeElement).toBe(rowAfter);
  });
});