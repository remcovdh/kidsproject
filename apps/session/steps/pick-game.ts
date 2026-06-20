import type { SessionState, Step } from "../main.js";

export function renderPickGame(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step">
      <h1 class="step__title">Hi ${state.childName}! 👋</h1>
      <p class="step__subtitle">Pick a game — we'll turn your drawing into it!</p>

      <div class="game-cards">

        <div class="game-card game-card--available">
          <div class="game-card__icon">🪣</div>
          <h2 class="game-card__name">Catcher</h2>
          <p class="game-card__desc">Move left and right to catch things falling from the sky!</p>
          <div class="game-card__controls"><kbd>←</kbd> <kbd>→</kbd></div>
          <a class="game-card__demo" href="/games/catcher/" target="_blank" rel="noopener">
            ▶ Try the demo first
          </a>
          <button class="btn btn--primary" id="pick-catcher">Pick this one! →</button>
        </div>

        <div class="game-card game-card--soon">
          <div class="game-card__icon">🐸</div>
          <h2 class="game-card__name">Jumper</h2>
          <p class="game-card__desc">Jump over obstacles — only one button!</p>
          <div class="game-card__controls"><kbd>SPACE</kbd></div>
          <div class="soon-badge">Coming soon 🚧</div>
        </div>

      </div>
    </div>
  `;

  container.querySelector("#pick-catcher")?.addEventListener("click", () => {
    goToStep("upload-drawing", { gameType: "catcher" });
  });
}
