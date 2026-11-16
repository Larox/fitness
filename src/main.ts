import "./style.css";
import { registerSW } from "virtual:pwa-register";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <main class="shell">
    <h1 class="shell__title">Fitness</h1>
    <p class="shell__lead">Your coach is coming in the next slice. Library import runs at build time via tests and future setup.</p>
    <p class="shell__muted">Install this app from the browser menu for offline access.</p>
  </main>
`;

registerSW({ immediate: true });