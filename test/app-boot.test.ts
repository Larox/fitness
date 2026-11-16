/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootApp } from "../src/app";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

function fixture(name: string): string {
  return readFileSync(join(repoRoot, name), "utf8");
}

describe("app boot", () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
  });

  it("mounts setup with the sample config and library", async () => {
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
    expect(document.body.textContent).not.toContain("Configuration problem");
    expect(root.textContent).toMatch(/Plan your training|Training settings/);
    vi.unstubAllGlobals();
  });
});