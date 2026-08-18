import type { AdminState, Screen } from "../main.js";
import { fetchRoster, uploadPhoto, fetchSessionInfo, sessionGalleryUrl, type RosterChild, type PhotoStatus } from "../api.js";
import { logout } from "../main.js";

const STATUS_LABEL: Record<PhotoStatus, string> = {
  none:                   "No photo yet",
  pending_child_confirm:  "Waiting for kid to confirm",
  approved:               "✅ Done",
  rejected:               "⚠️ Needs retake",
};

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export function renderRoster(
  container: HTMLElement,
  state: AdminState,
  goToScreen: (screen: Screen, update?: Partial<AdminState>) => void
) {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  const token = state.token ?? "";

  container.innerHTML = `
    <div class="panel">
      <button class="link-btn" id="back-btn">← All sessions</button>
      <div class="panel__header">
        <div>
          <h1 class="panel__title">${state.sessionName ?? "Session roster"}</h1>
          <p class="panel__subtitle" id="join-code-line">Join code: …</p>
        </div>
        <div class="panel__header-actions">
          <button class="btn btn--small btn--outline" id="share-gallery-btn">📤 Share gallery with families</button>
          <button class="btn btn--small" id="refresh-btn">Refresh</button>
          <button class="btn btn--small btn--outline" id="logout-btn">Log out</button>
        </div>
      </div>
      <table class="roster-table" id="roster-table">
        <thead>
          <tr><th>Child</th><th>Drawing</th><th>World</th><th>Published</th></tr>
        </thead>
        <tbody id="roster-body">
          <tr><td colspan="4" class="roster-loading">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  container.querySelector("#logout-btn")?.addEventListener("click", () => {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    logout();
  });
  container.querySelector("#back-btn")?.addEventListener("click", () => {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    goToScreen("sessions", { sessionId: "", sessionName: null });
  });
  container.querySelector("#refresh-btn")?.addEventListener("click", load);

  container.querySelector<HTMLButtonElement>("#share-gallery-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const url = sessionGalleryUrl(state.sessionId);
    try {
      await navigator.clipboard.writeText(url);
      btn.textContent = "Copied! ✅";
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — fall back to a dialog they can copy from.
      window.prompt("Copy this link to share with families:", url);
    }
    setTimeout(() => { btn.textContent = "📤 Share gallery with families"; }, 3000);
  });

  fetchSessionInfo(state.sessionId).then((info) => {
    const line = container.querySelector<HTMLElement>("#join-code-line");
    if (line) line.innerHTML = `Join code: <span class="join-code-badge">${info.joinCode}</span> — share this with the kids`;
  }).catch(() => { /* non-critical; roster still works without it */ });

  function statusCell(childId: string, kind: "drawing" | "world", status: PhotoStatus): string {
    return `
      <td class="roster-status roster-status--${status}">
        <span>${STATUS_LABEL[status]}</span>
        <label class="capture-btn">
          📸
          <input type="file" accept="image/*" capture="environment" hidden
            data-child="${childId}" data-kind="${kind}" />
        </label>
      </td>`;
  }

  function rowHtml(child: RosterChild): string {
    return `
      <tr>
        <td class="roster-child">
          <div class="roster-child__name">${child.name} ${child.displayCode ?? ""}</div>
        </td>
        ${statusCell(child.childId, "drawing", child.drawingStatus)}
        ${statusCell(child.childId, "world", child.worldStatus)}
        <td>${child.published ? "✅" : "—"}</td>
      </tr>`;
  }

  function wireCaptureInputs() {
    container.querySelectorAll<HTMLInputElement>('input[type="file"][data-child]').forEach((input) => {
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        const childId = input.dataset.child!;
        const kind = input.dataset.kind as "drawing" | "world";
        const label = input.closest<HTMLElement>(".capture-btn")!;
        label.classList.add("capture-btn--busy");
        try {
          await uploadPhoto(state.sessionId, childId, kind, file, token);
          await load();
        } catch (err) {
          console.error("[roster upload]", err);
          alert(err instanceof Error ? err.message : String(err));
          label.classList.remove("capture-btn--busy");
        }
      });
    });
  }

  async function load() {
    const body = container.querySelector<HTMLElement>("#roster-body")!;
    try {
      const roster = await fetchRoster(state.sessionId, token);
      if (roster.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="roster-loading">No kids registered yet.</td></tr>`;
        return;
      }
      body.innerHTML = roster.map(rowHtml).join("");
      wireCaptureInputs();
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
        logout();
        return;
      }
      body.innerHTML = `<tr><td colspan="4" class="roster-loading">Couldn't load roster: ${err instanceof Error ? err.message : String(err)}</td></tr>`;
    }
  }

  load();
  refreshTimer = setInterval(load, 5000);
}
