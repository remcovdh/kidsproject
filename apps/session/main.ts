import { fetchSession, type SessionConfig, type SpriteVersion } from "./api.js";
import { renderWelcome }            from "./steps/welcome.js";
import { renderPickGame }           from "./steps/pick-game.js";
import { renderUploadDrawing }      from "./steps/upload-drawing.js";
import { renderDescribeCharacter }  from "./steps/describe-character.js";
import { renderGenerateSprites }    from "./steps/generate-sprites.js";
import { renderPreviewGame }        from "./steps/preview-game.js";
import { renderCustomize }          from "./steps/customize.js";
import { renderPublish }            from "./steps/publish.js";
import { renderGallery }            from "./steps/gallery.js";

export type Step =
  | "welcome" | "pick-game" | "upload-drawing" | "describe-character"
  | "generate-sprites" | "preview-game" | "customize" | "publish" | "gallery";

export interface CharacterDescription {
  what: string;
  feeling: string;
  movement: string;
}

export interface SessionState {
  sessionId: string;
  sessionConfig: SessionConfig | null;
  childId: string | null;
  childName: string | null;
  gameType: "catcher" | "jumper" | null;
  drawingUrl: string | null;
  drawingBase64: string | null;
  characterDescription: CharacterDescription | null;
  spriteVersions: SpriteVersion[];
  activeSpriteVersionId: string | null;
  soundAssignments: Record<string, string>;
  published: boolean;
  currentStep: Step;
}

// Steps that show in the dot progress bar (welcome and gallery are outside this flow)
const PROGRESS_STEPS: Step[] = [
  "pick-game", "upload-drawing", "describe-character",
  "generate-sprites", "preview-game", "customize", "publish",
];

const state: SessionState = {
  sessionId: new URLSearchParams(location.search).get("s") ?? "demo",
  sessionConfig: null,
  childId: null,
  childName: null,
  gameType: null,
  drawingUrl: null,
  drawingBase64: null,
  characterDescription: null,
  spriteVersions: [],
  activeSpriteVersionId: null,
  soundAssignments: {},
  published: false,
  currentStep: "welcome",
};

export function goToStep(step: Step, update: Partial<SessionState> = {}) {
  Object.assign(state, update, { currentStep: step });
  render();
}

function progressBar(): string {
  const idx = PROGRESS_STEPS.indexOf(state.currentStep);
  if (idx === -1) return "";
  const dots = PROGRESS_STEPS.map((_, i) => {
    const cls = i < idx ? "done" : i === idx ? "active" : "upcoming";
    return `<div class="progress__dot progress__dot--${cls}"></div>`;
  }).join("");
  return `<div class="progress-bar"><div class="progress__dots">${dots}</div></div>`;
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = progressBar();

  const wrap = document.createElement("div");
  wrap.className = "step-wrap";
  app.appendChild(wrap);

  const handlers: Record<Step, (el: HTMLElement, s: SessionState, go: typeof goToStep) => void> = {
    "welcome":             renderWelcome,
    "pick-game":           renderPickGame,
    "upload-drawing":      renderUploadDrawing,
    "describe-character":  renderDescribeCharacter,
    "generate-sprites":    renderGenerateSprites,
    "preview-game":        renderPreviewGame,
    "customize":           renderCustomize,
    "publish":             renderPublish,
    "gallery":             renderGallery,
  };

  handlers[state.currentStep](wrap, state, goToStep);
}

fetchSession(state.sessionId).then((config) => {
  state.sessionConfig = config;
  render();
});
