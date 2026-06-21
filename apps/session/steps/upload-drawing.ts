import type { SessionState, Step } from "../main.js";
import { uploadDrawing } from "../api.js";

export function renderUploadDrawing(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step">
      <h1 class="step__title">Show us your drawing! 📸</h1>
      <p class="step__subtitle">Take a photo of your drawing on paper.</p>

      <label class="upload-area" id="upload-area">
        <div class="upload-area__icon">📷</div>
        <p class="upload-area__text">Tap here to take a photo</p>
        <p class="upload-area__sub">or choose from your gallery</p>
        <input type="file" id="file-input" accept="image/*" capture="environment" hidden />
      </label>

      <div class="drawing-preview" id="drawing-preview" hidden>
        <img id="preview-img" src="" alt="Your drawing" />
        <button class="btn btn--ghost btn--small" id="retake-btn">Take another photo 🔄</button>
      </div>

      <button class="btn btn--primary btn--big" id="next-btn" disabled>That's my drawing! →</button>
      <div class="error-box" id="error-box" hidden>
        <p class="error-box__child">Something went wrong with the upload. Ask your teacher for help! 🙋</p>
        <p class="error-box__detail" id="error-detail"></p>
      </div>
    </div>
  `;

  const fileInput  = container.querySelector<HTMLInputElement>("#file-input")!;
  const uploadArea = container.querySelector<HTMLElement>("#upload-area")!;
  const preview    = container.querySelector<HTMLElement>("#drawing-preview")!;
  const previewImg = container.querySelector<HTMLImageElement>("#preview-img")!;
  const retakeBtn  = container.querySelector<HTMLButtonElement>("#retake-btn")!;
  const nextBtn    = container.querySelector<HTMLButtonElement>("#next-btn")!;
  const errorBox   = container.querySelector<HTMLElement>("#error-box")!;
  const errorDetail = container.querySelector<HTMLElement>("#error-detail")!;
  let selectedFile: File | null = null;

  uploadArea.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
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

  nextBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    nextBtn.disabled = true;
    nextBtn.textContent = "Uploading... ⏳";
    errorBox.hidden = true;
    try {
      const result = await uploadDrawing(selectedFile);
      goToStep("upload-background", { drawingUrl: result.drawingUrl, drawingBase64: result.drawingBase64 });
    } catch (err) {
      console.error("[upload-drawing]", err);
      nextBtn.disabled = false;
      nextBtn.textContent = "That's my drawing! →";
      errorDetail.textContent = err instanceof Error ? err.message : String(err);
      errorBox.hidden = false;
    }
  });
}
