/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { AppConfig } from "../src/config/types";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { initialPersistedState } from "../src/setup/defaults";
import { mountSetupScreen } from "../src/setup/setup-screen";
import { createMemoryStorage } from "../src/setup/storage";

function demoConfig(): AppConfig {
  return {
    libraryPath: "data/sample-library.json",
    disclaimerVersion: 1,
    conditions: [
      {
        id: "concern_a",
        label: "Concern A",
        description: "Go easy on loaded movements",
        libraryField: "concern_a_risk",
      },
      {
        id: "concern_b",
        label: "Concern B",
        description: "Skip anything that causes discomfort",
        libraryField: "concern_b_risk",
      },
    ],
    equipment: {
      availableBellsKg: [6, 8],
      home: { bellsKg: [6] },
      gym: { bellsKg: [8] },
    },
  };
}

function settingsReadyStorage(config: AppConfig) {
  const storage = createMemoryStorage();
  let state = initialPersistedState(config);
  state = acknowledgeDisclaimer(state, config, new Date("2026-11-16T12:00:00.000Z"));
  state.setupComplete = true;
  storage.save(state);
  return storage;
}

describe("settings condition labels", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a two-target row and saves a renamed label", () => {
    const config = demoConfig();
    const mount = mountSetupScreen({
      config,
      storage: settingsReadyStorage(config),
      root,
    });
    const edit = root.querySelector<HTMLButtonElement>('[data-act="cond-edit"][data-v="concern_a"]');
    expect(edit).not.toBeNull();
    edit!.click();

    const name = document.querySelector<HTMLInputElement>("#cond-name");
    expect(name).not.toBeNull();
    name!.value = "Heavy days";
    name!.dispatchEvent(new Event("input", { bubbles: true }));

    const save = document.querySelector<HTMLButtonElement>('[data-act="cond-save"]');
    expect(save?.disabled).toBe(false);
    save!.click();

    const row = root.querySelector('[data-act="cond-edit"][data-v="concern_a"] .lb');
    expect(row?.textContent).toContain("Heavy days");
    expect(row?.textContent).toContain("Edited");

    const stored = mount.getState().conditionOverrides?.concern_a;
    expect(stored?.label).toBe("Heavy days");
    mount.destroy();
  });
});