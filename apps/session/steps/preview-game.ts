import type { SessionState, Step } from "../main.js";

export function renderPreviewGame(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--preview">
      <h1 class="step__title">Play your game! 🎮</h1>
      <p class="step__subtitle">Use the <kbd>←</kbd> <kbd>→</kbd> arrow keys to catch things!</p>
      <div class="game-frame-wrap">
        <iframe id="game-frame" src="/games/catcher/" title="Your game" allow="autoplay"></iframe>
      </div>
      <div class="step__actions">
        <button class="btn btn--ghost" id="back-btn">← Change character</button>
        <button class="btn btn--primary" id="next-btn">I love it! →</button>
      </div>
    </div>
  `;

  // The game reads kidsproject_sprites from localStorage on load.
  // We already stored it in generate-sprites before navigating here.

  container.querySelector("#back-btn")?.addEventListener("click", () => {
    goToStep("generate-sprites");
  });
  container.querySelector("#next-btn")?.addEventListener("click", () => {
    goToStep("customize");
  });
}
