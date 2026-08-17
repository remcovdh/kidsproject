import type { SessionState, Step } from "../main.js";
import { resolveJoinCode } from "../api.js";
import { joinSession } from "../main.js";

export function renderJoinSession(
  container: HTMLElement,
  _state: SessionState,
  _goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--welcome">
      <h1 class="welcome-title">AI GAME MAKER</h1>

      <div class="welcome-name-block">
        <p class="welcome-name-title">🔑 Enter your code</p>
        <p class="step__subtitle">Ask your teacher for the session code!</p>
        <input class="name-input code-input" type="text"
          placeholder="ABCD" autocomplete="off" maxlength="4" />
        <p class="field-error" id="join-error" hidden>That code didn't work — check with your teacher and try again!</p>
        <button class="btn btn--primary btn--big" id="join-btn" disabled>Join! →</button>
      </div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>(".code-input")!;
  const btn   = container.querySelector<HTMLButtonElement>("#join-btn")!;
  const error = container.querySelector<HTMLElement>("#join-error")!;

  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
    btn.disabled = input.value.trim().length === 0;
  });

  async function submit() {
    const code = input.value.trim();
    if (!code) return;
    btn.disabled = true;
    btn.textContent = "Checking... ⏳";
    error.hidden = true;
    try {
      const { id } = await resolveJoinCode(code);
      joinSession(id);
    } catch (err) {
      console.error("[join-session]", err);
      btn.disabled = false;
      btn.textContent = "Join! →";
      error.hidden = false;
    }
  }

  btn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !btn.disabled) submit(); });

  input.focus();
}
