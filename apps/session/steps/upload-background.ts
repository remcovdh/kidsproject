import type { SessionState, Step } from "../main.js";
import { uploadDrawing } from "../api.js";

export function renderUploadBackground(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step">
      <h1 class="step__title">Draw a background! 🌄</h1>
      <p class="step__subtitle">Draw the world your character will play in — a sky, a jungle, a city...</p>

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

      <div class="step__actions">
        <button class="btn btn--ghost" id="skip-btn">Skip — no background →</button>
        <button class="btn btn--primary btn--big" id="next-btn" disabled>Use this background! →</button>
      </div>
    </div>
  `;

  const fileInput  = container.querySelector<HTMLInputElement>("#bg-input")!;
  const uploadArea = container.querySelector<HTMLElement>("#upload-area")!;
  const preview    = container.querySelector<HTMLElement>("#bg-preview")!;
  const bgImg      = container.querySelector<HTMLImageElement>("#bg-img")!;
  const retakeBtn  = container.querySelector<HTMLButtonElement>("#retake-btn")!;
  const nextBtn    = container.querySelector<HTMLButtonElement>("#next-btn")!;
  const skipBtn    = container.querySelector<HTMLButtonElement>("#skip-btn")!;
  let selectedFile: File | null = null;

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

  skipBtn.addEventListener("click", () => {
    goToStep("describe-character", { backgroundUrl: null });
  });

  nextBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    nextBtn.disabled = true;
    nextBtn.textContent = "Uploading... ⏳";
    try {
      const result = await uploadDrawing(selectedFile);
      goToStep("describe-character", { backgroundUrl: result.drawingUrl });
    } catch {
      nextBtn.disabled = false;
      nextBtn.textContent = "Use this background! →";
    }
  });
}
