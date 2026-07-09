import type { SessionState, Step } from "../main.js";
import { registerChild } from "../api.js";

const STEPS = [
  { emoji: "✏️", label: "Draw",       desc: "Draw your character on paper" },
  { emoji: "📸", label: "Photo",      desc: "Take a photo of your drawing" },
  { emoji: "🤖", label: "AI magic",   desc: "AI turns it into a game character" },
  { emoji: "🎮", label: "Play!",      desc: "Play your very own game" },
  { emoji: "🌄", label: "Background", desc: "Add a cool background world" },
  { emoji: "🔊", label: "Sounds",     desc: "Pick fun sounds for your game" },
  { emoji: "🚀", label: "Share!",     desc: "Put it on the wall for everyone" },
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
            <div class="welcome-step__emoji">${s.emoji}</div>
            <p class="welcome-step__label">${s.label}</p>
            <p class="welcome-step__desc">${s.desc}</p>
          </div>
          ${i < STEPS.length - 1 ? `<div class="welcome-step__arrow">→</div>` : ""}
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
    const childId = await registerChild(state.sessionId, name);
    goToStep("pick-game", { childName: name, childId });
  });

  input.focus();
}
