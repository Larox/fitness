import "./setup/setup.css";
import { registerSW } from "virtual:pwa-register";
import { bootApp } from "./app";

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    throw new Error("#app not found");
  }
  await bootApp(app);
}

void boot();

registerSW({ immediate: true });