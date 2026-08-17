import type { SessionState, Step } from "../main.js";
import { fetchPhotoStatus, confirmPhoto, generateBackground } from "../api.js";

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

// Module scope so a stray poller from a previous mount never runs alongside a fresh
// one — main.ts has no unmount hook, so this must be cleared on every transition.
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function renderUploadBackground(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  let mode: "choose" | "helper-waiting" | "helper-confirm" | "ai" = "choose";
  let selectedBgDesc = "";
  let helperPhotoUrl = "";

  function draw() {
    if (mode === "choose") {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Add your World! 🌍</h1>
          <p class="step__subtitle">Give your game a world to play in — draw it yourself or let AI paint it!</p>

          <div class="game-cards" style="max-width:420px">
            <button class="game-card game-card--available" id="mode-helper">
              <div class="game-card__icon">📸</div>
              <p class="game-card__name">My helper will take a photo</p>
              <p class="game-card__desc">Ask a helper to photograph your World drawing</p>
            </button>
            <button class="game-card game-card--available" id="mode-ai">
              <div class="game-card__icon">✨</div>
              <p class="game-card__name">Ask the AI!</p>
              <p class="game-card__desc">Describe a World and AI will paint it for you</p>
            </button>
          </div>

          <button class="btn btn--ghost" id="skip-btn">Skip — no World →</button>
        </div>
      `;
      container.querySelector("#mode-helper")?.addEventListener("click", () => { mode = "helper-waiting"; draw(); });
      container.querySelector("#mode-ai")?.addEventListener("click",     () => { mode = "ai";             draw(); });
      container.querySelector("#skip-btn")?.addEventListener("click",    () => goToStep("customize", { backgroundUrl: null }));

    } else if (mode === "helper-waiting") {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Upload your World 📸</h1>
          <div class="waiting-box">
            <div class="loading-dots"><span></span><span></span><span></span></div>
            <p class="step__subtitle">Waiting for your helper to take a photo…</p>
          </div>
          <button class="btn btn--ghost" id="back-btn">← Back</button>
        </div>
      `;
      container.querySelector("#back-btn")?.addEventListener("click", () => {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        mode = "choose"; draw();
      });
      startPolling();

    } else if (mode === "helper-confirm") {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Is this your World? 🖼️</h1>
          <div class="drawing-preview">
            <img src="${helperPhotoUrl}" alt="Your World" />
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
        const existing = JSON.parse(localStorage.getItem("kidsproject_sprites") ?? "{}");
        localStorage.setItem("kidsproject_sprites", JSON.stringify({ ...existing, background: helperPhotoUrl }));
        goToStep("preview-game", { backgroundUrl: helperPhotoUrl, previewContext: "background" });
      });

      noBtn.addEventListener("click", async () => {
        yesBtn.disabled = true;
        noBtn.disabled  = true;
        await confirmPhoto(state.sessionId, state.childId ?? "", "world", false);
        mode = "helper-waiting";
        draw();
      });

    } else {
      // AI generation mode — pick a preset World or describe your own in words
      container.innerHTML = `
        <div class="step step--describe">
          <h1 class="step__title">What World do you want? ✨</h1>
          <p class="step__subtitle">Pick one or describe your own!</p>

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

          <div class="drawing-preview" id="bg-result" hidden>
            <img id="bg-result-img" src="" alt="Generated World" style="max-width:100%;border-radius:var(--radius-hero)" />
            <button class="btn btn--ghost btn--small" id="retry-bg-btn">Try a different description 🔄</button>
          </div>

          <div class="error-box" id="error-box" hidden>
            <p class="error-box__child">The AI couldn't paint the World. Ask your teacher for help! 🙋</p>
            <p class="error-box__detail" id="error-detail"></p>
          </div>

          <div class="step__actions">
            <button class="btn btn--ghost" id="back-btn">← Back</button>
            <button class="btn btn--primary btn--big" id="generate-btn" disabled>Paint it! ✨</button>
            <button class="btn btn--primary btn--big" id="use-btn" hidden>Use this World! →</button>
          </div>
        </div>
      `;

      const generateBtn = container.querySelector<HTMLButtonElement>("#generate-btn")!;
      const useBtn       = container.querySelector<HTMLButtonElement>("#use-btn")!;
      const resultBox    = container.querySelector<HTMLElement>("#bg-result")!;
      const resultImg    = container.querySelector<HTMLImageElement>("#bg-result-img")!;
      const errorBox     = container.querySelector<HTMLElement>("#error-box")!;
      const errorDetail  = container.querySelector<HTMLElement>("#error-detail")!;
      const customInput  = container.querySelector<HTMLInputElement>("#bg-custom")!;

      let generatedUrl = "";

      function updateGenerateBtn() {
        generateBtn.disabled = !selectedBgDesc.trim();
      }

      container.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          container.querySelectorAll(".chip").forEach(c => c.classList.remove("chip--active"));
          customInput.value = "";
          chip.classList.add("chip--active");
          selectedBgDesc = chip.dataset.value!;
          updateGenerateBtn();
        });
      });

      customInput.addEventListener("input", () => {
        container.querySelectorAll(".chip").forEach(c => c.classList.remove("chip--active"));
        selectedBgDesc = customInput.value.trim();
        updateGenerateBtn();
      });

      if (selectedBgDesc) updateGenerateBtn();

      container.querySelector("#back-btn")?.addEventListener("click", () => { mode = "choose"; draw(); });

      container.querySelector("#retry-bg-btn")?.addEventListener("click", () => {
        resultBox.hidden = true;
        useBtn.hidden = true;
        generateBtn.hidden = false;
        generateBtn.disabled = !selectedBgDesc.trim();
      });

      generateBtn.addEventListener("click", async () => {
        generateBtn.disabled = true;
        generateBtn.textContent = "Painting... ✨ (this takes ~15 seconds)";
        errorBox.hidden = true;
        resultBox.hidden = true;

        try {
          const aiProvider = state.sessionConfig?.aiProvider ?? "openai";
          const { backgroundUrl } = await generateBackground(selectedBgDesc, aiProvider);
          generatedUrl = backgroundUrl;
          if (backgroundUrl) {
            resultImg.src = backgroundUrl;
            resultBox.hidden = false;
          }
          generateBtn.hidden = true;
          useBtn.hidden = false;
        } catch (err) {
          console.error("[background-ai]", err);
          generateBtn.disabled = false;
          generateBtn.textContent = "Paint it! ✨";
          errorDetail.textContent = err instanceof Error ? err.message : String(err);
          errorBox.hidden = false;
        }
      });

      useBtn.addEventListener("click", () => {
        const existing = JSON.parse(localStorage.getItem("kidsproject_sprites") ?? "{}");
        localStorage.setItem("kidsproject_sprites", JSON.stringify({ ...existing, background: generatedUrl || undefined }));
        goToStep("preview-game", { backgroundUrl: generatedUrl || null, previewContext: "background" });
      });
    }
  }

  function startPolling() {
    const check = async () => {
      try {
        const res = await fetchPhotoStatus(state.sessionId, state.childId ?? "", "world");
        if (res.status === "pending_child_confirm" && res.url) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          helperPhotoUrl = res.url;
          mode = "helper-confirm";
          draw();
        }
      } catch (err) {
        console.error("[upload-background poll]", err);
      }
    };
    check();
    pollTimer = setInterval(check, 3000);
  }

  draw();
}
