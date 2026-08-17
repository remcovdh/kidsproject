import type { SessionState, Step } from "../main.js";

export function renderPickGame(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step">
      <h1 class="step__title" id="pick-game-title"></h1>
      <p class="step__subtitle">Pick a game — we'll turn your drawing into it!</p>

      <div class="game-cards" style="max-width:420px">

        <div class="game-card game-card--available">
          <div class="game-card__icon">🪣</div>
          <h2 class="game-card__name">Catcher</h2>
          <p class="game-card__desc">Move left and right to catch things falling from the sky!</p>
          <div class="game-card__controls"><kbd>←</kbd> <kbd>→</kbd></div>
          <button class="game-card__demo" id="demo-btn">▶ Try the demo first</button>
          <button class="btn btn--primary" id="pick-catcher">Pick this one! →</button>
        </div>

      </div>
    </div>

    <div class="modal" id="demo-modal" hidden aria-modal="true">
      <div class="modal__backdrop" id="demo-backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <span class="modal__title">🪣 Catcher — demo</span>
          <button class="modal__close" id="demo-close" aria-label="Back to game selection">← Back</button>
        </div>
        <iframe class="modal__frame" id="demo-frame" src="" title="Catcher demo" allow="autoplay"></iframe>
      </div>
    </div>
  `;

  container.querySelector<HTMLElement>("#pick-game-title")!.textContent =
    `Hi ${state.childName}! 👋`;

  const modal      = container.querySelector<HTMLElement>("#demo-modal")!;
  const demoFrame  = container.querySelector<HTMLIFrameElement>("#demo-frame")!;

  function openDemo() {
    demoFrame.src = "/games/catcher/";
    modal.hidden = false;
  }

  function closeDemo() {
    modal.hidden = true;
    demoFrame.src = "";
  }

  container.querySelector("#demo-btn")?.addEventListener("click", openDemo);
  container.querySelector("#demo-close")?.addEventListener("click", closeDemo);
  container.querySelector("#demo-backdrop")?.addEventListener("click", closeDemo);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDemo(); });

  container.querySelector("#pick-catcher")?.addEventListener("click", () => {
    goToStep("upload-drawing", { gameType: "catcher" });
  });
}
