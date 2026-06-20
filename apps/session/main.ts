import { renderWelcome } from "./steps/welcome.js";

// Steps in order — each step calls next() when done
const steps = [
  "welcome",
  "pick-game",
  "upload-drawing",
  "describe-character",
  "generate-sprites",
  "preview-game",
  "customize",
  "publish",
  "gallery",
] as const;

export type Step = typeof steps[number];

export interface SessionState {
  sessionId: string;
  childId: string | null;
  childName: string | null;
  gameType: "catcher" | "jumper" | null;
  drawingUrl: string | null;
  activeSpriteVersionId: string | null;
  currentStep: Step;
}

const state: SessionState = {
  sessionId: new URLSearchParams(location.search).get("s") ?? "",
  childId: null,
  childName: null,
  gameType: null,
  drawingUrl: null,
  activeSpriteVersionId: null,
  currentStep: "welcome",
};

export function goToStep(step: Step, update: Partial<SessionState> = {}) {
  Object.assign(state, update, { currentStep: step });
  render();
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  switch (state.currentStep) {
    case "welcome":
      renderWelcome(app, state, goToStep);
      break;
    default:
      app.textContent = `Step "${state.currentStep}" not yet implemented`;
  }
}

render();
