/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootApp } from "../src/app";
import { createMemoryStorage } from "../src/setup/storage";
import { acknowledgeDisclaimer } from "../src/setup/disclaimer";
import { loadAppConfig } from "../src/config/load";
import { defaultTrainingSettings } from "../src/setup/defaults";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const config = loadAppConfig(join(repoRoot, "config.example.json"));

function fixture(name: string): string {
  return readFileSync(join(repoRoot, name), "utf8");
}

describe("This week list after setup save", () => {
  let root: HTMLDivElement;
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
    storage = createMemoryStorage();
    const settings = defaultTrainingSettings(config);
    const acknowledged = acknowledgeDisclaimer(
      { setupComplete: false, settings },
      config,
      new Date("2026-01-01T00:00:00.000Z"),
    );
    storage.save(acknowledged);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        const state = storage.load();
        return state ? JSON.stringify(state) : null;
      },
      setItem: (_key: string, value: string) => {
        storage.save(JSON.parse(value));
      },
      removeItem: () => storage.clear(),
    });
  });

  it("opens Today after start training", async () => {
    const configJson = fixture("public/config.example.json");
    const libraryJson = fixture("public/data/sample-library.json");
    const overlayJson = fixture("public/data/overlay.json");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("config")) {
          return new Response(configJson, { status: 200 });
        }
        if (url.includes("sample-library")) {
          return new Response(libraryJson, { status: 200 });
        }
        if (url.includes("overlay")) {
          return new Response(overlayJson, { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );

    await bootApp(root);
    const save = document.querySelector<HTMLButtonElement>('[data-act="save"]');
    expect(save).toBeTruthy();
    save!.click();
    await vi.waitFor(
      () => {
        expect(root.className).toBe("today-shell");
      },
      { timeout: 2000 },
    );
    expect(root.textContent).toMatch(/TODAY|No plan yet|Rest is part|Tick off/);
    vi.unstubAllGlobals();
  });
});