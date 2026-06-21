import type { SessionState, Step } from "../main.js";

const SOUNDS = [
  { id: "boing",  label: "Boing",  emoji: "🎈" },
  { id: "splat",  label: "Splat",  emoji: "💦" },
  { id: "whoosh", label: "Whoosh", emoji: "💨" },
  { id: "pop",    label: "Pop",    emoji: "🫧" },
  { id: "squeak", label: "Squeak", emoji: "🐁" },
  { id: "roar",   label: "Roar",   emoji: "🦁" },
  { id: "giggle", label: "Giggle", emoji: "😄" },
  { id: "crash",  label: "Crash",  emoji: "💥" },
];

const EVENTS = [
  { id: "catch", label: "When you catch something" },
  { id: "miss",  label: "When you miss"            },
  { id: "win",   label: "When you win"             },
];

export function renderCustomize(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  const sounds = { ...state.soundAssignments };

  function draw() {
    container.innerHTML = `
      <div class="step step--customize">
        <h1 class="step__title">Make it yours! 🎨</h1>

        <div class="sound-section">
          <h2 class="section-title">Pick your sounds</h2>
          <div class="error-box" id="sound-notice" hidden>
            <p class="error-box__child">Sound previews aren't working right now 🔇</p>
            <p class="error-box__detail">Sound files are missing. Place MP3s in apps/games/catcher/assets/sounds/ named boing.mp3, splat.mp3, etc.</p>
          </div>
          ${EVENTS.map((ev) => `
            <div class="sound-event">
              <p class="sound-event__label">${ev.label}</p>
              <div class="sound-chips">
                ${SOUNDS.map((s) => `
                  <button class="sound-chip ${sounds[ev.id] === s.id ? "sound-chip--active" : ""}"
                    data-event="${ev.id}" data-sound="${s.id}">
                    ${s.emoji} ${s.label}
                  </button>`).join("")}
              </div>
            </div>`).join("")}
        </div>

        <div class="code-peek-wrap">
          <button class="btn btn--ghost btn--small" id="peek-btn">👀 How does this work?</button>
          <pre class="code-peek" id="code-peek" hidden>// When your character catches something:
if (caught) {
  score = score + 1;
  playSound("${sounds["catch"] ?? "boing"}");
}

// Score keeps adding up — can you get 10?</pre>
        </div>

        <div class="step__actions">
          <button class="btn btn--ghost" id="back-btn">← Back</button>
          <button class="btn btn--primary btn--big" id="next-btn">Put it on the wall! 🚀</button>
        </div>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>(".sound-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sounds[chip.dataset.event!] = chip.dataset.sound!;
        const audio = new Audio(`/games/catcher/assets/sounds/${chip.dataset.sound}.mp3`);
        audio.addEventListener("error", () => {
          const notice = container.querySelector<HTMLElement>("#sound-notice");
          if (notice) notice.hidden = false;
        });
        audio.play().catch(() => {});
        draw();
      });
    });

    container.querySelector("#peek-btn")?.addEventListener("click", () => {
      const pre = container.querySelector<HTMLElement>("#code-peek")!;
      pre.hidden = !pre.hidden;
    });
    container.querySelector("#back-btn")?.addEventListener("click", () => goToStep("preview-game"));
    container.querySelector("#next-btn")?.addEventListener("click", () => {
      goToStep("publish", { soundAssignments: sounds });
    });
  }

  draw();
}
