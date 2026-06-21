import type { SessionState, Step } from "../main.js";
import { fetchGallery, type GalleryItem } from "../api.js";

export function renderGallery(
  container: HTMLElement,
  state: SessionState,
  _goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--gallery">
      <h1 class="step__title">🎪 Game Gallery</h1>
      <p class="step__subtitle">${state.sessionConfig?.name ?? "Session"} — everyone's games!</p>
      ${state.published ? `<div class="success-banner">✅ Your game is on the wall, ${state.childName}!</div>` : ""}
      <div class="gallery-grid" id="gallery-grid"><p class="gallery__loading">Loading...</p></div>
      <button class="btn btn--ghost btn--small" id="refresh-btn">Refresh 🔄</button>
    </div>

    <div class="modal" id="game-modal" hidden aria-modal="true">
      <div class="modal__backdrop" id="modal-backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <span class="modal__title" id="modal-title"></span>
          <button class="modal__close" id="modal-close" aria-label="Close">✕</button>
        </div>
        <iframe class="modal__frame" id="modal-frame" src="" title="Game" allow="autoplay"></iframe>
      </div>
    </div>
  `;

  const grid       = container.querySelector<HTMLElement>("#gallery-grid")!;
  const modal      = container.querySelector<HTMLElement>("#game-modal")!;
  const modalTitle = container.querySelector<HTMLElement>("#modal-title")!;
  const modalFrame = container.querySelector<HTMLIFrameElement>("#modal-frame")!;

  function openGame(item: GalleryItem) {
    localStorage.setItem("kidsproject_sprites", JSON.stringify({
      ...item.sprites,
      ...(item.backgroundUrl ? { background: item.backgroundUrl } : {}),
    }));
    modalTitle.textContent = `${item.childName}'s game`;
    modalFrame.src = `/games/${item.gameType}/`;
    modal.hidden = false;
  }

  function closeModal() {
    modal.hidden = true;
    modalFrame.src = "";
  }

  container.querySelector("#modal-close")?.addEventListener("click", closeModal);
  container.querySelector("#modal-backdrop")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function load() {
    grid.innerHTML = `<p class="gallery__loading">Loading...</p>`;
    fetchGallery(state.sessionId).then((items) => {
      if (items.length === 0) {
        grid.innerHTML = `<p class="gallery__empty">No games yet — be the first!</p>`;
        return;
      }
      grid.innerHTML = items.map((item, i) => `
        <button class="gallery-card" data-idx="${i}">
          <img class="gallery-card__img" src="${item.previewUrl}" alt="${item.childName}" />
          <span class="gallery-card__name">${item.childName}</span>
          <span class="gallery-card__play">▶ Play</span>
        </button>`).join("");

      grid.querySelectorAll<HTMLButtonElement>(".gallery-card").forEach((card) => {
        card.addEventListener("click", () => openGame(items[Number(card.dataset.idx)]));
      });
    });
  }

  container.querySelector("#refresh-btn")?.addEventListener("click", load);
  load();
}
