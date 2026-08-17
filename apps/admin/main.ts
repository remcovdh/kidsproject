import { renderLogin }    from "./screens/login.js";
import { renderSessions } from "./screens/sessions.js";
import { renderRoster }   from "./screens/roster.js";

export type Screen = "login" | "sessions" | "roster";

export interface AdminState {
  sessionId: string;
  sessionName: string | null;
  token: string | null;
}

const state: AdminState = {
  // Empty (not "demo") when no ?s= is given — that's the signal to land on the sessions
  // list instead of a specific roster after login.
  sessionId:   new URLSearchParams(location.search).get("s") ?? "",
  sessionName: null,
  token:       localStorage.getItem("admin_token"),
};

let screen: Screen = !state.token ? "login" : (state.sessionId ? "roster" : "sessions");

export function goToScreen(next: Screen, update: Partial<AdminState> = {}) {
  Object.assign(state, update);
  screen = next;
  render();
}

export function logout() {
  state.token = null;
  localStorage.removeItem("admin_token");
  goToScreen("login");
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "screen-wrap";
  app.appendChild(wrap);

  if (screen === "login") renderLogin(wrap, state, goToScreen);
  else if (screen === "sessions") renderSessions(wrap, state, goToScreen);
  else renderRoster(wrap, state, goToScreen);
}

render();
