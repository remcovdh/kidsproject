import { renderLogin }  from "./screens/login.js";
import { renderRoster } from "./screens/roster.js";

export type Screen = "login" | "roster";

export interface AdminState {
  sessionId: string;
  token: string | null;
}

const state: AdminState = {
  sessionId: new URLSearchParams(location.search).get("s") ?? "demo",
  token: localStorage.getItem("admin_token"),
};

let screen: Screen = state.token ? "roster" : "login";

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
  else renderRoster(wrap, state, goToScreen);
}

render();
