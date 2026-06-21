import type { SessionState, Step } from "../main.js";
import { uploadDrawing, generateBackground, fileToBase64 } from "../api.js";

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
      // AI generation mode — supports text prompt, optional inspiration photo, and style alignment
      const d = state.characterDescription;
      const charStyleText = d ? `a ${d.feeling} ${d.what} that moves in a ${d.movement} way` : "";

      container.innerHTML = `
        <div class="step step--describe">
          <h1 class="step__title">What world do you want? ✨</h1>
          <p class="step__subtitle">Pick one or describe your own!</p>

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

          <div class="inspiration-section">
            <button class="btn btn--ghost btn--small" id="inspiration-toggle">
              📸 Add a photo as inspiration (optional)
            </button>
            <div id="inspiration-body" hidden style="margin-top:.75rem">
              <label class="upload-area upload-area--small" id="inspiration-upload-area">
                <div class="upload-area__icon" style="font-size:1.6rem">🖼️</div>
                <p class="upload-area__text" style="font-size:.9rem">Tap to add a photo</p>
                <input type="file" id="inspiration-input" accept="image/*" capture="environment" hidden />
              </label>
              <div id="inspiration-preview" hidden style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem">
                <img id="inspiration-img" src="" alt="Inspiration"
                  style="height:72px;border-radius:var(--radius);object-fit:cover" />
                <button class="btn btn--ghost btn--small" id="remove-inspiration-btn">Remove ✕</button>
              </div>
            </div>
          </div>

          ${charStyleText ? `
          <label class="checkbox-row" style="margin-top:.75rem">
            <input type="checkbox" id="style-match-cb" />
            <span>Match my character's style ✨</span>
          </label>` : ""}

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

      const generateBtn        = container.querySelector<HTMLButtonElement>("#generate-btn")!;
      const useBtn             = container.querySelector<HTMLButtonElement>("#use-btn")!;
      const resultBox          = container.querySelector<HTMLElement>("#bg-result")!;
      const resultImg          = container.querySelector<HTMLImageElement>("#bg-result-img")!;
      const errorBox           = container.querySelector<HTMLElement>("#error-box")!;
      const errorDetail        = container.querySelector<HTMLElement>("#error-detail")!;
      const customInput        = container.querySelector<HTMLInputElement>("#bg-custom")!;
      const inspirationToggle  = container.querySelector<HTMLButtonElement>("#inspiration-toggle")!;
      const inspirationBody    = container.querySelector<HTMLElement>("#inspiration-body")!;
      const inspirationArea    = container.querySelector<HTMLElement>("#inspiration-upload-area")!;
      const inspirationInput   = container.querySelector<HTMLInputElement>("#inspiration-input")!;
      const inspirationPreview = container.querySelector<HTMLElement>("#inspiration-preview")!;
      const inspirationImg     = container.querySelector<HTMLImageElement>("#inspiration-img")!;
      const removeInspirationBtn = container.querySelector<HTMLButtonElement>("#remove-inspiration-btn");
      const styleMatchCb       = container.querySelector<HTMLInputElement>("#style-match-cb");

      let inspirationFile: File | null = null;
      let generatedUrl = "";

      function updateGenerateBtn() {
        generateBtn.disabled = !selectedBgDesc.trim() && !inspirationFile;
      }

      // Chip selection
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

      // Inspiration photo toggle
      inspirationToggle.addEventListener("click", () => {
        const expanded = !inspirationBody.hidden;
        inspirationBody.hidden = expanded;
        inspirationToggle.textContent = expanded
          ? "📸 Add a photo as inspiration (optional)"
          : "📸 Hide inspiration photo ▲";
      });

      inspirationArea.addEventListener("click", () => inspirationInput.click());

      inspirationInput.addEventListener("change", () => {
        const file = inspirationInput.files?.[0];
        if (!file) return;
        inspirationFile = file;
        inspirationImg.src = URL.createObjectURL(file);
        inspirationArea.hidden = true;
        inspirationPreview.hidden = false;
        updateGenerateBtn();
      });

      removeInspirationBtn?.addEventListener("click", () => {
        inspirationFile = null;
        inspirationInput.value = "";
        inspirationArea.hidden = false;
        inspirationPreview.hidden = true;
        updateGenerateBtn();
      });

      // Navigation
      container.querySelector("#back-btn")?.addEventListener("click", () => { mode = "choose"; draw(); });

      container.querySelector("#retry-bg-btn")?.addEventListener("click", () => {
        resultBox.hidden = true;
        useBtn.hidden = true;
        generateBtn.hidden = false;
        generateBtn.disabled = !selectedBgDesc.trim() && !inspirationFile;
      });

      // Generate
      generateBtn.addEventListener("click", async () => {
        generateBtn.disabled = true;
        generateBtn.textContent = "Painting... ✨ (this takes ~15 seconds)";
        errorBox.hidden = true;
        resultBox.hidden = true;

        try {
          const aiProvider = state.sessionConfig?.aiProvider ?? "openai";
          const imageBase64 = inspirationFile ? await fileToBase64(inspirationFile) : undefined;
          const styleDescription = styleMatchCb?.checked ? charStyleText : undefined;
          const { backgroundUrl } = await generateBackground(selectedBgDesc, aiProvider, imageBase64, styleDescription);
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
        goToStep("customize", { backgroundUrl: generatedUrl || null });
      });
    }
  }

  draw();
}
