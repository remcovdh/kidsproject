import type { SessionState, Step } from "../main.js";
import { generateSprites, chooseSprites, uploadDrawing, type SpriteVersion, type SpriteGenChoice } from "../api.js";

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
  const styleMode: "shape" | "copy" = state.characterDescription?.styleMode ?? "shape";
  const artStyle = state.characterDescription?.artStyle ?? "cartoon";

  type Phase = "loading" | "choose" | "result";
  let phase: Phase = "loading";
  let versions = [...state.spriteVersions];
  let currentVersion: SpriteVersion | null = null;
  let pendingChoice: SpriteGenChoice | null = null;

  function draw() {
    if (phase === "loading") renderLoading();
    else if (phase === "choose") renderChoose();
    else renderResult();
  }

  function renderLoading() {
    // This is a plain-language summary of what's about to happen, not the literal text sent to
    // the AI — the real prompt also includes what the AI sees when it looks at the drawing,
    // which we don't know yet at this point. The exact prompt actually used is shown on the
    // result screen once generation finishes.
    const styleLabel = styleMode === "copy" ? "in your own drawing style" : `in a ${artStyle} style`;

    container.innerHTML = `
      <div class="step step--generate">
        <h1 class="step__title">Asking the AI... ✨</h1>
        ${show
          ? `<div class="prompt-box"><p class="prompt-box__label">Here's what we're asking for:</p>
               <p class="prompt-box__text">A ${desc}, drawn ${styleLabel}, in 4 poses: standing still, running right, running left, and celebrating — all drawn together so they match.</p></div>`
          : `<p class="step__subtitle">The AI is drawing your character right now!</p>`}
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <p class="loading-hint">This takes about 10 seconds...</p>
      </div>
    `;

    generateSprites(state.childId ?? "anon", desc, styleMode, artStyle)
      .then((choice) => {
        pendingChoice = choice;
        phase = "choose";
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
          goToStep("describe-character");
        });
      });
  }

  function renderChoose() {
    const choice = pendingChoice!;

    container.innerHTML = `
      <div class="step step--generate">
        <h1 class="step__title">Which one do you like better? 🤔</h1>
        <div class="choice-grid">
          <button class="choice-card" data-pick="text">
            <img src="${choice.options.text.sprites.idle}" alt="Option A" />
          </button>
          <button class="choice-card" data-pick="image">
            <img src="${choice.options.image.sprites.idle}" alt="Option B" />
          </button>
        </div>
        <p class="step__subtitle">Tap the one you like!</p>
      </div>
    `;

    container.querySelectorAll<HTMLButtonElement>(".choice-card").forEach((card) => {
      card.addEventListener("click", async () => {
        const chosen = card.dataset.pick as "text" | "image";
        container.querySelectorAll<HTMLButtonElement>(".choice-card").forEach((c) => c.disabled = true);
        card.classList.add("choice-card--picked");
        try {
          const version = await chooseSprites(state.childId ?? "anon", choice.versionId, chosen);
          currentVersion = version;
          versions = [...versions, version];
          phase = "result";
          draw();
        } catch (err) {
          console.error("[generate-sprites choose]", err);
          container.querySelectorAll<HTMLButtonElement>(".choice-card").forEach((c) => c.disabled = false);
          card.classList.remove("choice-card--picked");
        }
      });
    });
  }

  function renderResult() {
    const version = currentVersion!;

    container.innerHTML = `
      <div class="step step--generate">
        <h1 class="step__title">Here's your character! 🎉</h1>
        ${spritePoses(version)}
        ${show
          ? `<div class="prompt-box"><p class="prompt-box__label">What we actually asked the AI:</p><p class="prompt-box__text">${version.prompt}</p></div>`
          : ""}
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
      goToStep("describe-character");
    });
  }

  draw();
}
