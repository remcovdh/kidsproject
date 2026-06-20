import type { SessionState, Step } from "../main.js";
import { generateSprites, type SpriteVersion } from "../api.js";

function description(state: SessionState): string {
  const d = state.characterDescription ?? { what: "character", feeling: "happy", movement: "bouncy" };
  return `A ${d.feeling} ${d.what} that moves in a ${d.movement} way`;
}

function spritePoses(v: SpriteVersion): string {
  const poses: Array<[keyof SpriteVersion["sprites"], string]> = [
    ["idle",      "Standing still"],
    ["move",      "Moving"],
    ["action",    "Action!"],
    ["celebrate", "Celebrating"],
  ];
  return `<div class="sprite-grid">
    ${poses.map(([key, label]) => `
      <div class="sprite-tile">
        <img src="${v.sprites[key]}" alt="${label}" />
        <span>${label}</span>
      </div>`).join("")}
  </div>`;
}

function history(versions: SpriteVersion[], onPick: (v: SpriteVersion) => void): HTMLElement {
  const wrap = document.createElement("div");
  if (versions.length < 2) return wrap;
  wrap.className = "history";
  wrap.innerHTML = `<p class="history__label">Your tries:</p>
    <div class="history__row">
      ${versions.map((v) => `
        <button class="history__thumb" data-id="${v.id}">
          <img src="${v.sprites.idle}" alt="${v.label}" />
          <span>${v.label}</span>
        </button>`).join("")}
    </div>`;
  wrap.querySelectorAll<HTMLButtonElement>(".history__thumb").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = versions.find((x) => x.id === btn.dataset.id);
      if (v) onPick(v);
    });
  });
  return wrap;
}

export function renderGenerateSprites(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  const desc   = description(state);
  const prompt = `Turn this child's drawing into a game character sprite pack. The character is: ${desc}. Keep the original childlike style and colors. Create 4 poses: idle, move, action, celebrate.`;
  const show   = state.sessionConfig?.showPrompt ?? false;

  container.innerHTML = `
    <div class="step step--generate">
      <h1 class="step__title">Asking the AI... ✨</h1>
      ${show
        ? `<div class="prompt-box"><p class="prompt-box__label">We're sending this to the AI:</p><p class="prompt-box__text">${prompt}</p></div>`
        : `<p class="step__subtitle">The AI is drawing your character right now!</p>`}
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p class="loading-hint">This takes about 10 seconds...</p>
    </div>
  `;

  generateSprites(state.childId ?? "anon", desc, state.drawingBase64 ?? "")
    .then((version) => {
      const versions = [...state.spriteVersions, version];

      container.innerHTML = `
        <div class="step step--generate">
          <h1 class="step__title">Here's your character! 🎉</h1>
          ${spritePoses(version)}
          <div class="step__actions">
            <button class="btn btn--ghost" id="retry-btn">Try again 🔄</button>
            <button class="btn btn--primary" id="play-btn">Let's play! ▶</button>
          </div>
        </div>
      `;

      container.querySelector(".step")!.appendChild(
        history(versions, (v) => {
          localStorage.setItem("kidsproject_sprites", JSON.stringify(v.sprites));
          goToStep("preview-game", { spriteVersions: versions, activeSpriteVersionId: v.id });
        })
      );

      container.querySelector("#play-btn")?.addEventListener("click", () => {
        localStorage.setItem("kidsproject_sprites", JSON.stringify(version.sprites));
        goToStep("preview-game", { spriteVersions: versions, activeSpriteVersionId: version.id });
      });

      container.querySelector("#retry-btn")?.addEventListener("click", () => {
        goToStep("generate-sprites", { spriteVersions: versions });
      });
    })
    .catch(() => {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Oops! 😅</h1>
          <p class="step__subtitle">Something went wrong. Let's try again!</p>
          <button class="btn btn--primary" id="retry-btn">Try again</button>
        </div>
      `;
      container.querySelector("#retry-btn")?.addEventListener("click", () => {
        goToStep("generate-sprites");
      });
    });
}
