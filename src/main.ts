import "./setup/setup.css";
import { registerSW } from "virtual:pwa-register";
import { fetchAppConfig } from "./config/fetch-config";
import { renderConfigError, mountSetupScreen } from "./setup/setup-screen";
import { createLocalStorageAdapter } from "./setup/storage";

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("#app not found");
  }

  const loaded = await fetchAppConfig();
  if ("errors" in loaded) {
    renderConfigError(app, loaded.errors);
    return;
  }

  mountSetupScreen({
    config: loaded.config,
    storage: createLocalStorageAdapter(),
    root: app,
  });
}

void boot();

registerSW({ immediate: true });