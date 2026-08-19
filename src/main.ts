import "./style.css";
import { GameLab } from "./app/GameLab";
import { createLabLayout } from "./ui/layout";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app mount point");
}

const ui = createLabLayout(root);

GameLab.create(ui).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to initialize paper-doll lab", error);
  ui.canvasMount.innerHTML = `<div class="canvas-loading">The character lab could not start.<br>${message}</div>`;
});
