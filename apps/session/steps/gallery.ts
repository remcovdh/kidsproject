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
      <p class="step__subtitle" id="gallery-subtitle"></p>
      <div id="gallery-banner"></div>
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

  container.querySelector<HTMLElement>("#gallery-subtitle")!.textContent =
    `${state.sessionConfig?.name ?? "Session"} — everyone's games!`;

  if (state.published) {
    const banner = document.createElement("div");
    banner.className = "success-banner";
    banner.textContent = `✅ Your game is on the wall, ${state.childName}!`;
    container.querySelector("#gallery-banner")!.replaceWith(banner);
  }

  const grid       = container.querySelector<HTMLElement>("#gallery-grid")!;
  const modal      = container.querySelector<HTMLElement>("#game-modal")!;
  const modalTitle = container.querySelector<HTMLElement>("#modal-title")!;
  const modalFrame = container.querySelector<HTMLIFrameElement>("#modal-frame")!;

  const ALLOWED_GAME_TYPES = ["catcher"];

  function openGame(item: GalleryItem) {
    if (!ALLOWED_GAME_TYPES.includes(item.gameType)) return;
    localStorage.setItem("kidsproject_sprites", JSON.stringify({
      ...item.sprites,
      ...(item.backgroundUrl ? { background: item.backgroundUrl } : {}),
      sound_catch: item.sounds?.["catch"] ?? "",
      sound_miss:  item.sounds?.["miss"]  ?? "",
      sound_win:   item.sounds?.["win"]   ?? "",
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
      const fragment = document.createDocumentFragment();
      items.forEach((item) => {
        const card = document.createElement("button");
        card.className = "gallery-card";

        const img = document.createElement("img");
        img.className = "gallery-card__img";
        img.src = item.previewUrl;
        img.alt = item.childName;

        const nameSpan = document.createElement("span");
        nameSpan.className = "gallery-card__name";
        nameSpan.textContent = item.childName;

        const playSpan = document.createElement("span");
        playSpan.className = "gallery-card__play";
        playSpan.textContent = "▶ Play";

        card.append(img, nameSpan, playSpan);
        card.addEventListener("click", () => openGame(item));
        fragment.appendChild(card);
      });
      grid.innerHTML = "";
      grid.appendChild(fragment);
    });
  }

  container.querySelector("#refresh-btn")?.addEventListener("click", load);
  load();
}
