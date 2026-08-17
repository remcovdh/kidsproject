import type { SessionState, Step } from "../main.js";
import { fetchPhotoStatus, confirmPhoto } from "../api.js";

// Module scope so a stray poller from a previous mount of this screen never runs
// alongside a fresh one — main.ts has no unmount hook, so this must be cleared
// explicitly on every transition away from the waiting phase.
let pollTimer: ReturnType<typeof setInterval> | null = null;

export function renderUploadDrawing(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }

  type Phase = "waiting" | "confirm";
  let phase: Phase = "waiting";
  let photoUrl = "";

  function draw() {
    if (phase === "waiting") renderWaiting();
    else renderConfirm();
  }

  function renderWaiting() {
    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Draw your character! ✏️</h1>

        <div class="explain-cards">
          <div class="explain-card">
            <div class="explain-card__emoji">✏️</div>
            <p class="explain-card__text">Draw <strong>any character</strong> you like on paper!</p>
          </div>
          <div class="explain-card explain-card--arrow">→</div>
          <div class="explain-card">
            <div class="explain-card__emoji">🙋</div>
            <p class="explain-card__text">Ask a <strong>helper</strong> to take a photo of it</p>
          </div>
        </div>

        <div class="waiting-box">
          <div class="loading-dots"><span></span><span></span><span></span></div>
          <p class="step__subtitle">Waiting for your helper to take a photo…</p>
        </div>
      </div>
    `;
    startPolling();
  }

  function startPolling() {
    const check = async () => {
      try {
        const res = await fetchPhotoStatus(state.sessionId, state.childId ?? "", "drawing");
        if (res.status === "pending_child_confirm" && res.url) {
          if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          photoUrl = res.url;
          phase = "confirm";
          draw();
        }
      } catch (err) {
        console.error("[upload-drawing poll]", err);
      }
    };
    check();
    pollTimer = setInterval(check, 3000);
  }

  function renderConfirm() {
    container.innerHTML = `
      <div class="step">
        <h1 class="step__title">Is this your drawing? 🖼️</h1>
        <div class="drawing-preview">
          <img src="${photoUrl}" alt="Your drawing" />
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
      await confirmPhoto(state.sessionId, state.childId ?? "", "drawing", true);
      goToStep("describe-character", { drawingUrl: photoUrl });
    });

    noBtn.addEventListener("click", async () => {
      yesBtn.disabled = true;
      noBtn.disabled  = true;
      await confirmPhoto(state.sessionId, state.childId ?? "", "drawing", false);
      phase = "waiting";
      draw();
    });
  }

  draw();
}
