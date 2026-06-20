import type { SessionState, Step } from "../main.js";

export function renderWelcome(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--welcome">
      <h1 class="step__title">What is your name?</h1>
      <input
        class="step__name-input"
        type="text"
        placeholder="Type your name..."
        autocomplete="off"
        maxlength="30"
      />
      <button class="step__next btn btn--primary" disabled>
        Let's go! →
      </button>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>(".step__name-input")!;
  const btn = container.querySelector<HTMLButtonElement>(".step__next")!;

  input.addEventListener("input", () => {
    btn.disabled = input.value.trim().length === 0;
  });

  btn.addEventListener("click", () => {
    goToStep("pick-game", { childName: input.value.trim() });
  });

  input.focus();
}
