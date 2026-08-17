import type { AdminState, Screen } from "../main.js";
import { login } from "../api.js";

export function renderLogin(
  container: HTMLElement,
  state: AdminState,
  goToScreen: (screen: Screen, update?: Partial<AdminState>) => void
) {
  container.innerHTML = `
    <div class="panel panel--narrow">
      <h1 class="panel__title">Helper login</h1>
      <p class="panel__subtitle">Enter the facilitator password to help kids with photos.</p>
      <input class="text-input" type="password" id="password-input" placeholder="Password" autocomplete="current-password" />
      <p class="field-error" id="field-error" hidden></p>
      <button class="btn btn--primary" id="login-btn">Log in</button>
    </div>
  `;

  const input     = container.querySelector<HTMLInputElement>("#password-input")!;
  const btn       = container.querySelector<HTMLButtonElement>("#login-btn")!;
  const fieldErr  = container.querySelector<HTMLElement>("#field-error")!;

  async function submit() {
    btn.disabled = true;
    btn.textContent = "Logging in…";
    fieldErr.hidden = true;
    try {
      const token = await login(input.value);
      localStorage.setItem("admin_token", token);
      goToScreen("roster", { token });
    } catch (err) {
      fieldErr.textContent = err instanceof Error ? err.message : String(err);
      fieldErr.hidden = false;
      btn.disabled = false;
      btn.textContent = "Log in";
    }
  }

  btn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  input.focus();
}
