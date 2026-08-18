import type { AdminState, Screen } from "../main.js";
import { fetchSessions, createSession, sessionGalleryUrl, type SessionSummary } from "../api.js";
import { logout } from "../main.js";

export function renderSessions(
  container: HTMLElement,
  state: AdminState,
  goToScreen: (screen: Screen, update?: Partial<AdminState>) => void
) {
  const token = state.token ?? "";

  container.innerHTML = `
    <div class="panel">
      <div class="panel__header">
        <h1 class="panel__title">Sessions</h1>
        <button class="btn btn--small btn--outline" id="logout-btn">Log out</button>
      </div>

      <div class="create-session-box">
        <h2 class="section-title" style="margin-top:0">Create a new session</h2>
        <input class="text-input" id="new-name" placeholder="Session name (e.g. Class 4B)" maxlength="80" />
        <select class="text-input" id="new-provider">
          <option value="openai">OpenAI</option>
          <option value="local">Local / offline</option>
          <option value="gemini">Gemini</option>
        </select>
        <label class="checkbox-row">
          <input type="checkbox" id="new-show-prompt" checked />
          Show the AI prompt to kids
        </label>
        <button class="btn btn--primary" id="create-btn">+ Create session</button>
        <p class="field-error" id="create-error" hidden></p>
      </div>

      <h2 class="section-title">Existing sessions</h2>
      <table class="roster-table" id="sessions-table">
        <thead><tr><th>Name</th><th>Join code</th><th>Kids</th><th>Gallery</th></tr></thead>
        <tbody id="sessions-body"><tr><td colspan="4" class="roster-loading">Loading…</td></tr></tbody>
      </table>
    </div>
  `;

  container.querySelector("#logout-btn")?.addEventListener("click", logout);

  const nameInput   = container.querySelector<HTMLInputElement>("#new-name")!;
  const providerSel  = container.querySelector<HTMLSelectElement>("#new-provider")!;
  const showPromptCb = container.querySelector<HTMLInputElement>("#new-show-prompt")!;
  const createBtn    = container.querySelector<HTMLButtonElement>("#create-btn")!;
  const createError  = container.querySelector<HTMLElement>("#create-error")!;

  createBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) {
      createError.textContent = "Give the session a name first.";
      createError.hidden = false;
      return;
    }
    createBtn.disabled = true;
    createError.hidden = true;
    try {
      const { id } = await createSession(name, providerSel.value, showPromptCb.checked, token);
      goToScreen("roster", { sessionId: id, sessionName: name });
    } catch (err) {
      createError.textContent = err instanceof Error ? err.message : String(err);
      createError.hidden = false;
      createBtn.disabled = false;
    }
  });

  function rowHtml(s: SessionSummary): string {
    return `
      <tr class="session-row" data-id="${s.id}" data-name="${s.name}">
        <td>${s.name}</td>
        <td><span class="join-code-badge">${s.joinCode}</span></td>
        <td>${s.childCount}</td>
        <td><button class="btn btn--small btn--outline share-gallery-btn" data-id="${s.id}">📤 Share</button></td>
      </tr>`;
  }

  async function load() {
    const body = container.querySelector<HTMLElement>("#sessions-body")!;
    try {
      const sessions = await fetchSessions(token);
      if (sessions.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="roster-loading">No sessions yet — create one above.</td></tr>`;
        return;
      }
      body.innerHTML = sessions.map(rowHtml).join("");
      body.querySelectorAll<HTMLElement>(".session-row").forEach((row) => {
        row.addEventListener("click", () => {
          goToScreen("roster", { sessionId: row.dataset.id!, sessionName: row.dataset.name ?? null });
        });
      });
      body.querySelectorAll<HTMLButtonElement>(".share-gallery-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation(); // don't also trigger the row's "open roster" click
          const url = sessionGalleryUrl(btn.dataset.id!);
          try {
            await navigator.clipboard.writeText(url);
            btn.textContent = "Copied! ✅";
          } catch {
            window.prompt("Copy this link to share with families:", url);
          }
          setTimeout(() => { btn.textContent = "📤 Share"; }, 3000);
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") { logout(); return; }
      body.innerHTML = `<tr><td colspan="4" class="roster-loading">Couldn't load sessions: ${err instanceof Error ? err.message : String(err)}</td></tr>`;
    }
  }

  load();
}
