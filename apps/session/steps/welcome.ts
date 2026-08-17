import type { SessionState, Step } from "../main.js";
import { registerChild } from "../api.js";

const STEPS = [
  { emoji: "🎨", label: "Make character", desc: "Draw and bring your character to life with AI" },
  { emoji: "🎮", label: "Test & play",    desc: "Try your character in the game" },
  { emoji: "🌍", label: "Add World",      desc: "Pick or paint a world to play in" },
  { emoji: "🎮", label: "Test & play",    desc: "See your world in the game" },
  { emoji: "🔊", label: "Add sound",      desc: "Pick fun sounds for your game" },
  { emoji: "🎮", label: "Test & play",    desc: "Hear your sounds in the game" },
  { emoji: "🚀", label: "Share!",         desc: "Put it on the wall for everyone" },
];

export function renderWelcome(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--welcome">
      <h1 class="welcome-title">AI GAME MAKER</h1>
      <p class="welcome-tagline">Turn your drawing into a real game — with help from AI!</p>

      <div class="welcome-steps">
        ${STEPS.map((s, i) => `
          <div class="welcome-step">
            <span class="welcome-step__num">${i + 1}</span>
            <div class="welcome-step__emoji">${s.emoji}</div>
            <p class="welcome-step__label">${s.label}</p>
            <p class="welcome-step__desc">${s.desc}</p>
          </div>
        `).join("")}
      </div>

      <div class="welcome-name-block">
        <p class="welcome-name-title">👋 What's your name?</p>
        <p class="welcome-name-hint">Playing together with a friend? Write both your names!</p>
        <input class="name-input" type="text"
          placeholder="Your name (or team name)..."
          autocomplete="off" maxlength="40" />
        <button class="btn btn--primary btn--big" id="start-btn" disabled>Let's go! →</button>
      </div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>(".name-input")!;
  const btn   = container.querySelector<HTMLButtonElement>("#start-btn")!;

  input.addEventListener("input", () => { btn.disabled = input.value.trim().length === 0; });

  btn.addEventListener("click", async () => {
    const name = input.value.trim();
    btn.disabled = true;
    btn.textContent = "Starting... 🎈";
    const { childId, displayCode } = await registerChild(state.sessionId, name);
    goToStep("pick-game", { childName: name, childId, childDisplayCode: displayCode });
  });

  input.focus();
}
