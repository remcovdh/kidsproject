import type { SessionState, Step } from "../main.js";
import { generateSprites, uploadDrawing, type SpriteVersion } from "../api.js";

const ART_STYLES = [
  { id: "cartoon",                  label: "Cartoon",    emoji: "🎨" },
  { id: "watercolor painting",      label: "Watercolor", emoji: "🌊" },
  { id: "pixel art",                label: "Pixel",      emoji: "⚡" },
  { id: "comic book",               label: "Comic",      emoji: "🦸" },
  { id: "kawaii cute",              label: "Kawaii",     emoji: "🐱" },
  { id: "children's storybook",     label: "Storybook",  emoji: "📖" },
];

function characterDesc(state: SessionState): string {
  const d = state.characterDescription ?? { what: "character", feeling: "happy", movement: "bouncy" };
  return `A ${d.feeling} ${d.what} that moves in a ${d.movement} way`;
}

function saveToLocalStorage(sprites: SpriteVersion["sprites"], backgroundUrl: string | null) {
  localStorage.setItem("kidsproject_sprites", JSON.stringify({
    ...sprites,
    ...(backgroundUrl ? { background: backgroundUrl } : {}),
  }));
}

function spritePoses(v: SpriteVersion): string {
  const poses: Array<[keyof SpriteVersion["sprites"], string]> = [
    ["idle",      "Standing still"],
    ["move",      "Moving"],
    ["celebrate", "Celebrating"],
  ];
  const characterTiles = poses.map(([key, label]) => `
    <div class="sprite-tile">
      <img src="${v.sprites[key]}" alt="${label}" />
      <span>${label}</span>
    </div>`).join("");
  const collectibleTile = `
    <div class="sprite-tile sprite-tile--collectible">
      <img id="collectible-img" src="${v.sprites.collectible}" alt="Falling item ⭐" />
      <span>Falling item ⭐</span>
      <button class="btn btn--ghost btn--small" id="draw-collectible-btn">Draw your own ✏️</button>
      <input type="file" id="collectible-input" accept="image/*" capture="environment" hidden />
    </div>`;
  return `<div class="sprite-grid">${characterTiles}${collectibleTile}</div>`;
}

function historyEl(versions: SpriteVersion[], onPick: (v: SpriteVersion) => void): HTMLElement {
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
  const desc = characterDesc(state);
  const show = state.sessionConfig?.showPrompt ?? false;

  type Phase = "pick-style" | "loading" | "result";
  let phase: Phase = "pick-style";
  let styleMode: "copy" | "restyle" = "copy";
  let artStyle = "";
  let versions = [...state.spriteVersions];
  let currentVersion: SpriteVersion | null = null;

  function draw() {
    if (phase === "pick-style") renderStylePicker();
    else if (phase === "loading") renderLoading();
    else renderResult();
  }

  function renderStylePicker() {
    const generateEnabled = styleMode === "copy" || (styleMode === "restyle" && !!artStyle);
    container.innerHTML = `
      <div class="step step--generate">
        <h1 class="step__title">How should it look? 🎨</h1>
        <p class="step__subtitle">Should the AI copy your drawing style, or give your character a brand new look?</p>

        <div class="style-picker">
          <button class="style-option ${styleMode === "copy" ? "style-option--active" : ""}" id="style-copy">
            <div class="style-option__icon">📸</div>
            <p class="style-option__name">Copy my style</p>
            <p class="style-option__desc">Keep the exact look of my drawing</p>
          </button>
          <button class="style-option ${styleMode === "restyle" ? "style-option--active" : ""}" id="style-restyle">
            <div class="style-option__icon">✨</div>
            <p class="style-option__name">New style!</p>
            <p class="style-option__desc">Pick a totally different look</p>
          </button>
        </div>

        <div id="art-style-picker" ${styleMode !== "restyle" ? "hidden" : ""} style="width:100%;text-align:left">
          <p class="describe-label" style="margin-bottom:.5rem">Pick a style:</p>
          <div class="chip-group">
            ${ART_STYLES.map((s) => `
              <button class="chip ${artStyle === s.id ? "chip--active" : ""}" data-style="${s.id}">
                <span class="chip__emoji">${s.emoji}</span>
                <span class="chip__label">${s.label}</span>
              </button>`).join("")}
          </div>
        </div>

        <button class="btn btn--primary btn--big" id="generate-btn" ${generateEnabled ? "" : "disabled"}>
          Create it! ✨
        </button>
      </div>
    `;

    container.querySelector("#style-copy")?.addEventListener("click", () => {
      styleMode = "copy"; artStyle = ""; draw();
    });
    container.querySelector("#style-restyle")?.addEventListener("click", () => {
      styleMode = "restyle"; draw();
    });
    container.querySelectorAll<HTMLButtonElement>("[data-style]").forEach((chip) => {
      chip.addEventListener("click", () => { artStyle = chip.dataset.style!; draw(); });
    });
    container.querySelector("#generate-btn")?.addEventListener("click", () => {
      phase = "loading"; draw();
    });
  }

  function renderLoading() {
    const styleLabel = styleMode === "copy"
      ? "Copy the exact childlike style and colors from the drawing."
      : `Apply ${artStyle} art style to the character's shape.`;
    const prompt = `Turn this child's drawing into a game character sprite pack. The character is: ${desc}. ${styleLabel} Create 3 poses: idle, move, celebrate.`;

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

    generateSprites(state.childId ?? "anon", desc, state.drawingBase64 ?? "", styleMode, artStyle)
      .then((version) => {
        currentVersion = version;
        versions = [...versions, version];
        phase = "result";
        draw();
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err);
        console.error("[generate-sprites]", err);
        container.innerHTML = `
          <div class="step">
            <h1 class="step__title">Oops! 😅</h1>
            <p class="step__subtitle">The AI couldn't make your character this time.</p>
            <div class="error-box">
              <p class="error-box__child">Ask your teacher or helper for help! 🙋</p>
              <p class="error-box__detail">${detail}</p>
            </div>
            <button class="btn btn--primary" id="retry-btn">Try again 🔄</button>
          </div>
        `;
        container.querySelector("#retry-btn")?.addEventListener("click", () => {
          phase = "pick-style"; draw();
        });
      });
  }

  function renderResult() {
    const version = currentVersion!;

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
      historyEl(versions, (v) => {
        saveToLocalStorage(v.sprites, state.backgroundUrl);
        goToStep("preview-game", { spriteVersions: versions, activeSpriteVersionId: v.id, previewContext: "character" });
      })
    );

    const drawCollectibleBtn = container.querySelector<HTMLButtonElement>("#draw-collectible-btn")!;
    const collectibleInput   = container.querySelector<HTMLInputElement>("#collectible-input")!;
    const collectibleImg     = container.querySelector<HTMLImageElement>("#collectible-img")!;

    drawCollectibleBtn.addEventListener("click", () => collectibleInput.click());

    collectibleInput.addEventListener("change", async () => {
      const file = collectibleInput.files?.[0];
      if (!file) return;
      drawCollectibleBtn.disabled = true;
      drawCollectibleBtn.textContent = "Uploading... ⏳";
      try {
        const { drawingUrl } = await uploadDrawing(file);
        version.sprites.collectible = drawingUrl;
        collectibleImg.src = drawingUrl;
        saveToLocalStorage(version.sprites, state.backgroundUrl);
        drawCollectibleBtn.textContent = "✅ Changed!";
        drawCollectibleBtn.disabled = false;
      } catch (err) {
        console.error("[generate-sprites collectible]", err);
        drawCollectibleBtn.textContent = "Draw your own ✏️";
        drawCollectibleBtn.disabled = false;
      }
    });

    container.querySelector("#play-btn")?.addEventListener("click", () => {
      saveToLocalStorage(version.sprites, state.backgroundUrl);
      goToStep("preview-game", { spriteVersions: versions, activeSpriteVersionId: version.id, previewContext: "character" });
    });

    container.querySelector("#retry-btn")?.addEventListener("click", () => {
      phase = "pick-style"; draw();
    });
  }

  draw();
}
