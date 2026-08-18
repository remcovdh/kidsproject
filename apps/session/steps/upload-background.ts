import type { SessionState, Step } from "../main.js";
import { fetchPhotoStatus, confirmPhoto, generateBackground, chooseBackground, type BackgroundGenChoice } from "../api.js";

const BG_CHIPS = [
  { v: "a sunny meadow with flowers and butterflies", l: "Meadow",     e: "🌸" },
  { v: "outer space with stars and planets",          l: "Space",      e: "🚀" },
  { v: "an underwater ocean with fish and coral",     l: "Ocean",      e: "🐠" },
  { v: "a spooky haunted forest at night",            l: "Spooky",     e: "🎃" },
  { v: "a snowy winter mountain",                     l: "Snow",       e: "⛄" },
  { v: "a futuristic neon city at night",             l: "City",       e: "🏙️" },
  { v: "a magical fairy tale castle",                 l: "Castle",     e: "🏰" },
  { v: "a volcanic lava landscape",                   l: "Volcano",    e: "🌋" },
];

const STYLE = [
  { v: "cartoon",                 l: "Cartoon",    e: "🎨" },
  { v: "watercolor painting",     l: "Watercolor", e: "🌊" },
  { v: "pixel art",               l: "Pixel",      e: "⚡" },
  { v: "comic book",              l: "Comic",      e: "🦸" },
  { v: "kawaii cute",             l: "Kawaii",     e: "🐱" },
  { v: "children's storybook",    l: "Storybook",  e: "📖" },
  { v: "as-drawn",                l: "As drawn",   e: "✏️" },
];

// Module scope so a stray poller from a previous mount never runs alongside a fresh
// one — main.ts has no unmount hook, so this must be cleared on every transition.
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function renderUploadBackground(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  const show = state.sessionConfig?.showPrompt ?? false;

  type Phase = "waiting" | "confirm" | "describe" | "loading" | "choose" | "result";
  let phase: Phase = "waiting";
  let photoUrl = "";
  let selectedBgDesc = "";
  let selectedStyle = "";
  let generatedUrl = "";
  let generatedPrompt = "";
  let pendingChoice: BackgroundGenChoice | null = null;

  function draw() {
    if (phase === "waiting") renderWaiting();
    else if (phase === "confirm") renderConfirm();
    else if (phase === "describe") renderDescribe();
    else if (phase === "loading") renderLoading();
    else if (phase === "choose") renderChoose();
    else renderResult();
  }

  function renderWaiting() {
    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Add your World! 🌍</h1>
        <div class="waiting-box">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <p class="step__subtitle">Waiting for your helper to take a photo…</p>
        </div>
        <button class="btn btn--ghost" id="skip-btn">Skip — no World →</button>
      </div>
    `;
    container.querySelector("#skip-btn")?.addEventListener("click", () => {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      goToStep("customize", { backgroundUrl: null });
    });
    startPolling();
  }

  function startPolling() {
    const check = async () => {
      try {
        const res = await fetchPhotoStatus(state.sessionId, state.childId ?? "", "world");
        if (res.status === "pending_child_confirm" && res.url) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          photoUrl = res.url;
          phase = "confirm";
          draw();
        }
      } catch (err) {
        console.error("[upload-background poll]", err);
      }
    };
    check();
    pollTimer = setInterval(check, 3000);
  }

  function renderConfirm() {
    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Is this your World? 🖼️</h1>
        <div class="drawing-preview">
          <img src="${photoUrl}" alt="Your World" />
        </div>
        <div class="step__actions">
          <button class="btn btn--ghost btn--big" id="no-btn">No 🙅</button>
          <button class="btn btn--primary btn--big" id="yes-btn">Yes, that's mine! ✅</button>
        </div>
      </div>
    `;

    const yesBtn = container.querySelector<HTMLButtonElement>("#yes-btn")!;
    const noBtn  = container.querySelector<HTMLButtonElement>("#no-btn")!;

    yesBtn.addEventListener("click", async () => {
      yesBtn.disabled = true;
      noBtn.disabled  = true;
      await confirmPhoto(state.sessionId, state.childId ?? "", "world", true);
      phase = "describe";
      draw();
    });

    noBtn.addEventListener("click", async () => {
      yesBtn.disabled = true;
      noBtn.disabled  = true;
      await confirmPhoto(state.sessionId, state.childId ?? "", "world", false);
      phase = "waiting";
      draw();
    });
  }

  function renderDescribe() {
    container.innerHTML = `
      <div class="step step--describe">
        <img class="drawing-thumb" src="${photoUrl}" alt="Your World" />
        <h1 class="step__title">What World do you want? ✨</h1>
        <p class="step__subtitle">The AI will start from your photo — pick a style, and describe it if you like!</p>

        <div class="describe-block">
          <p class="describe-label">Your World is...</p>
          <div class="chip-group" id="bg-chips">
            ${BG_CHIPS.map(c => `
              <button class="chip ${selectedBgDesc === c.v ? "chip--active" : ""}" data-value="${c.v}">
                <span class="chip__emoji">${c.e}</span>
                <span class="chip__label">${c.l}</span>
              </button>`).join("")}
            <input class="chip-custom" id="bg-custom" type="text"
              placeholder="or describe your own World..." maxlength="80"
              value="${selectedBgDesc && !BG_CHIPS.find(c => c.v === selectedBgDesc) ? selectedBgDesc : ""}" />
          </div>
        </div>

        <div class="describe-block">
          <p class="describe-label">Draw it as...</p>
          <div class="chip-group" id="style-chips">
            ${STYLE.map(s => `
              <button class="chip ${selectedStyle === s.v ? "chip--active" : ""}" data-value="${s.v}">
                <span class="chip__emoji">${s.e}</span>
                <span class="chip__label">${s.l}</span>
              </button>`).join("")}
          </div>
        </div>

        <div class="step__actions">
          <button class="btn btn--ghost" id="back-btn">← Back</button>
          <button class="btn btn--primary btn--big" id="generate-btn" ${selectedStyle ? "" : "disabled"}>Paint it! ✨</button>
        </div>
      </div>
    `;

    const customInput = container.querySelector<HTMLInputElement>("#bg-custom")!;
    const generateBtn = container.querySelector<HTMLButtonElement>("#generate-btn")!;

    container.querySelectorAll<HTMLButtonElement>("#bg-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        container.querySelectorAll("#bg-chips .chip").forEach(c => c.classList.remove("chip--active"));
        customInput.value = "";
        chip.classList.add("chip--active");
        selectedBgDesc = chip.dataset.value!;
      });
    });
    customInput.addEventListener("input", () => {
      container.querySelectorAll("#bg-chips .chip").forEach(c => c.classList.remove("chip--active"));
      selectedBgDesc = customInput.value.trim();
    });

    container.querySelectorAll<HTMLButtonElement>("#style-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        container.querySelectorAll("#style-chips .chip").forEach(c => c.classList.remove("chip--active"));
        chip.classList.add("chip--active");
        selectedStyle = chip.dataset.value!;
        generateBtn.disabled = false;
      });
    });

    container.querySelector("#back-btn")?.addEventListener("click", () => {
      phase = "waiting";
      draw();
    });
    generateBtn.addEventListener("click", () => {
      phase = "loading";
      draw();
    });
  }

  function renderLoading() {
    const styleMode: "shape" | "copy" = selectedStyle === "as-drawn" ? "copy" : "shape";
    const artStyle = selectedStyle === "as-drawn" ? "" : selectedStyle;
    // Plain-language summary — the real prompt also depends on what the AI sees when it looks
    // at the photo, which we don't know yet here. The exact prompt actually used is shown on
    // the result screen once generation finishes.
    const styleLabel = styleMode === "copy" ? "in the same style as your photo" : `in a ${artStyle} style`;
    const themeLabel = selectedBgDesc ? selectedBgDesc : "your photo";

    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Painting your World... ✨</h1>
        ${show
          ? `<div class="prompt-box"><p class="prompt-box__label">Here's what we're asking for:</p>
               <p class="prompt-box__text">A World based on your photo, showing ${themeLabel}, drawn ${styleLabel}.</p></div>`
          : `<p class="step__subtitle">This takes about 15 seconds...</p>`}
        <div class="loading-dots"><span></span><span></span><span></span></div>
      </div>
    `;

    (async () => {
      try {
        pendingChoice = await generateBackground(state.childId ?? "", selectedBgDesc, styleMode, artStyle);
        phase = "choose";
        draw();
      } catch (err) {
        console.error("[background-ai]", err);
        container.innerHTML = `
          <div class="step">
            <h1 class="step__title">Oops! 😅</h1>
            <p class="step__subtitle">The AI couldn't paint your World this time.</p>
            <div class="error-box">
              <p class="error-box__child">Ask your teacher or helper for help! 🙋</p>
              <p class="error-box__detail">${err instanceof Error ? err.message : String(err)}</p>
            </div>
            <button class="btn btn--primary" id="retry-btn">Try again 🔄</button>
          </div>
        `;
        container.querySelector("#retry-btn")?.addEventListener("click", () => {
          phase = "describe";
          draw();
        });
      }
    })();
  }

  function renderChoose() {
    const choice = pendingChoice!;

    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Which one do you like better? 🤔</h1>
        <div class="choice-grid">
          <button class="choice-card" data-pick="text">
            <img src="${choice.options.text.backgroundUrl}" alt="Option A" />
          </button>
          <button class="choice-card" data-pick="image">
            <img src="${choice.options.image.backgroundUrl}" alt="Option B" />
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
          const result = await chooseBackground(state.childId ?? "", choice.versionId, chosen);
          generatedUrl = result.backgroundUrl;
          generatedPrompt = result.prompt;
          phase = "result";
          draw();
        } catch (err) {
          console.error("[upload-background choose]", err);
          container.querySelectorAll<HTMLButtonElement>(".choice-card").forEach((c) => c.disabled = false);
          card.classList.remove("choice-card--picked");
        }
      });
    });
  }

  function renderResult() {
    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Here's your World! 🎉</h1>
        <div class="drawing-preview">
          <img src="${generatedUrl}" alt="Your World" />
        </div>
        ${show
          ? `<div class="prompt-box"><p class="prompt-box__label">What we actually asked the AI:</p><p class="prompt-box__text">${generatedPrompt}</p></div>`
          : ""}
        <div class="step__actions">
          <button class="btn btn--ghost" id="retry-btn">Try again 🔄</button>
          <button class="btn btn--primary btn--big" id="use-btn">Use this World! →</button>
        </div>
      </div>
    `;

    container.querySelector("#retry-btn")?.addEventListener("click", () => {
      phase = "describe";
      draw();
    });
    container.querySelector("#use-btn")?.addEventListener("click", () => {
      const existing = JSON.parse(localStorage.getItem("kidsproject_sprites") ?? "{}");
      localStorage.setItem("kidsproject_sprites", JSON.stringify({ ...existing, background: generatedUrl }));
      goToStep("preview-game", { backgroundUrl: generatedUrl, previewContext: "background" });
    });
  }

  draw();
}
