import type { SessionState, Step } from "../main.js";

export function renderPreviewGame(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  const ctx = state.previewContext ?? "character";

  const backLabel = ctx === "background" ? "← Change World"
    : ctx === "sounds"     ? "← Change sounds"
    : "← Change character";

  const nextLabel = ctx === "background" ? "I love it! Add sound →"
    : ctx === "sounds"     ? "Looks great! Put it on the wall! 🚀"
    : "I love it! Add a World →";

  container.innerHTML = `
    <div class="step step--preview">
      <h1 class="step__title">Play your game! 🎮</h1>
      <p class="step__subtitle">Use the <kbd>←</kbd> <kbd>→</kbd> arrow keys to catch things!</p>
      <div class="game-frame-wrap">
        <iframe id="game-frame" src="/games/catcher/" title="Your game" allow="autoplay"></iframe>
      </div>
      <div class="step__actions">
        <button class="btn btn--ghost" id="back-btn">${backLabel}</button>
        <button class="btn btn--primary" id="next-btn">${nextLabel}</button>
      </div>
    </div>
  `;

  container.querySelector("#back-btn")?.addEventListener("click", () => {
    if (ctx === "background") goToStep("upload-background");
    else if (ctx === "sounds") goToStep("customize");
    else goToStep("generate-sprites");
  });

  container.querySelector("#next-btn")?.addEventListener("click", () => {
    if (ctx === "background") goToStep("customize");
    else if (ctx === "sounds") goToStep("publish");
    else goToStep("upload-background");
  });
}
