import type { SessionState, Step } from "../main.js";
import { registerChild } from "../api.js";

export function renderWelcome(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  const sessionName = state.sessionConfig?.name ?? "AI Workshop";

  container.innerHTML = `
    <div class="step step--welcome">
      <div class="step__hero">🎮</div>
      <h1 class="step__title">${sessionName}</h1>
      <p class="step__subtitle">What's your name?</p>
      <input class="name-input" type="text" placeholder="Type your name..." autocomplete="off" maxlength="30" />
      <button class="btn btn--primary btn--big" id="start-btn" disabled>Let's go! →</button>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>(".name-input")!;
  const btn   = container.querySelector<HTMLButtonElement>("#start-btn")!;

  input.addEventListener("input", () => { btn.disabled = input.value.trim().length === 0; });

  btn.addEventListener("click", async () => {
    const name = input.value.trim();
    btn.disabled = true;
    btn.textContent = "Starting...";
    const childId = await registerChild(state.sessionId, name);
    goToStep("pick-game", { childName: name, childId });
  });

  input.focus();
}
