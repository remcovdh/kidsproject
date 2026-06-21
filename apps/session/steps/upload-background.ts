import type { SessionState, Step } from "../main.js";
import { uploadDrawing, generateBackground } from "../api.js";

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

export function renderUploadBackground(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  let mode: "choose" | "upload" | "ai" = "choose";
  let selectedFile: File | null = null;
  let selectedBgDesc = "";

  function draw() {
    if (mode === "choose") {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Add a background! 🌄</h1>
          <p class="step__subtitle">Give your game world a scene — draw it yourself or let AI paint it!</p>

          <div class="game-cards" style="max-width:420px">
            <button class="game-card game-card--available" id="mode-upload">
              <div class="game-card__icon">📸</div>
              <p class="game-card__name">Upload my drawing</p>
              <p class="game-card__desc">Take a photo of your own background drawing</p>
            </button>
            <button class="game-card game-card--available" id="mode-ai">
              <div class="game-card__icon">✨</div>
              <p class="game-card__name">Ask the AI!</p>
              <p class="game-card__desc">Describe a world and AI will paint it for you</p>
            </button>
          </div>

          <button class="btn btn--ghost" id="skip-btn">Skip — no background →</button>
        </div>
      `;
      container.querySelector("#mode-upload")?.addEventListener("click", () => { mode = "upload"; draw(); });
      container.querySelector("#mode-ai")?.addEventListener("click",    () => { mode = "ai";     draw(); });
      container.querySelector("#skip-btn")?.addEventListener("click",   () => goToStep("customize", { backgroundUrl: null }));

    } else if (mode === "upload") {
      container.innerHTML = `
        <div class="step">
          <h1 class="step__title">Upload your background 📸</h1>
          <p class="step__subtitle">Take a photo of your background drawing.</p>

          <label class="upload-area" id="upload-area">
            <div class="upload-area__icon">🖼️</div>
            <p class="upload-area__text">Tap to upload your background</p>
            <p class="upload-area__sub">or take a photo of your drawing</p>
            <input type="file" id="bg-input" accept="image/*" capture="environment" hidden />
          </label>

          <div class="drawing-preview" id="bg-preview" hidden>
            <img id="bg-img" src="" alt="Your background" />
            <button class="btn btn--ghost btn--small" id="retake-btn">Try another 🔄</button>
          </div>

          <div class="error-box" id="error-box" hidden>
            <p class="error-box__child">Something went wrong with the upload. Ask your teacher for help! 🙋</p>
            <p class="error-box__detail" id="error-detail"></p>
          </div>

          <div class="step__actions">
            <button class="btn btn--ghost" id="back-btn">← Back</button>
            <button class="btn btn--primary btn--big" id="next-btn" disabled>Use this background! →</button>
          </div>
        </div>
      `;

      const fileInput   = container.querySelector<HTMLInputElement>("#bg-input")!;
      const uploadArea  = container.querySelector<HTMLElement>("#upload-area")!;
      const preview     = container.querySelector<HTMLElement>("#bg-preview")!;
      const bgImg       = container.querySelector<HTMLImageElement>("#bg-img")!;
      const retakeBtn   = container.querySelector<HTMLButtonElement>("#retake-btn")!;
      const nextBtn     = container.querySelector<HTMLButtonElement>("#next-btn")!;
      const errorBox    = container.querySelector<HTMLElement>("#error-box")!;
      const errorDetail = container.querySelector<HTMLElement>("#error-detail")!;

      uploadArea.addEventListener("click", () => fileInput.click());

      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        selectedFile = file;
        bgImg.src = URL.createObjectURL(file);
        uploadArea.hidden = true;
        preview.hidden = false;
        nextBtn.disabled = false;
      });

      retakeBtn.addEventListener("click", () => {
        selectedFile = null;
        fileInput.value = "";
        uploadArea.hidden = false;
        preview.hidden = true;
        nextBtn.disabled = true;
      });

      container.querySelector("#back-btn")?.addEventListener("click", () => { mode = "choose"; draw(); });

      nextBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        nextBtn.disabled = true;
        nextBtn.textContent = "Uploading... ⏳";
        errorBox.hidden = true;
        try {
          const result = await uploadDrawing(selectedFile);
          goToStep("customize", { backgroundUrl: result.drawingUrl });
        } catch (err) {
          console.error("[upload-background]", err);
          nextBtn.disabled = false;
          nextBtn.textContent = "Use this background! →";
          errorDetail.textContent = err instanceof Error ? err.message : String(err);
          errorBox.hidden = false;
        }
      });

    } else {
      // AI generation mode
      container.innerHTML = `
        <div class="step step--describe">
          <h1 class="step__title">What world do you want? ✨</h1>
          <p class="step__subtitle">Pick one or write your own!</p>

          <div class="chip-group" id="bg-chips">
            ${BG_CHIPS.map(c => `
              <button class="chip ${selectedBgDesc === c.v ? "chip--active" : ""}" data-value="${c.v}">
                <span class="chip__emoji">${c.e}</span>
                <span class="chip__label">${c.l}</span>
              </button>`).join("")}
            <input class="chip-custom" id="bg-custom" type="text"
              placeholder="or describe your own world..." maxlength="80"
              value="${selectedBgDesc && !BG_CHIPS.find(c => c.v === selectedBgDesc) ? selectedBgDesc : ""}" />
          </div>

          <div class="drawing-preview" id="bg-result" hidden>
            <img id="bg-result-img" src="" alt="Generated background" style="max-width:100%;border-radius:var(--radius)" />
            <button class="btn btn--ghost btn--small" id="retry-bg-btn">Try a different description 🔄</button>
          </div>

          <div class="error-box" id="error-box" hidden>
            <p class="error-box__child">The AI couldn't paint the background. Ask your teacher for help! 🙋</p>
            <p class="error-box__detail" id="error-detail"></p>
          </div>

          <div class="step__actions">
            <button class="btn btn--ghost" id="back-btn">← Back</button>
            <button class="btn btn--primary btn--big" id="generate-btn" disabled>Paint it! ✨</button>
            <button class="btn btn--primary btn--big" id="use-btn" hidden>Use this background! →</button>
          </div>
        </div>
      `;

      const generateBtn  = container.querySelector<HTMLButtonElement>("#generate-btn")!;
      const useBtn       = container.querySelector<HTMLButtonElement>("#use-btn")!;
      const resultBox    = container.querySelector<HTMLElement>("#bg-result")!;
      const resultImg    = container.querySelector<HTMLImageElement>("#bg-result-img")!;
      const errorBox     = container.querySelector<HTMLElement>("#error-box")!;
      const errorDetail  = container.querySelector<HTMLElement>("#error-detail")!;
      const customInput  = container.querySelector<HTMLInputElement>("#bg-custom")!;
      let generatedUrl   = "";

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
        if (!selectedBgDesc.trim()) return;
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
          } else {
            // mock mode — no real image
            resultBox.hidden = true;
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
        goToStep("customize", { backgroundUrl: generatedUrl || null });
      });
    }
  }

  draw();
}
