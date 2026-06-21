import { fetchSession, type SessionConfig, type SpriteVersion } from "./api.js";
import { renderWelcome }            from "./steps/welcome.js";
import { renderPickGame }           from "./steps/pick-game.js";
import { renderUploadDrawing }      from "./steps/upload-drawing.js";
import { renderUploadBackground }   from "./steps/upload-background.js";
import { renderDescribeCharacter }  from "./steps/describe-character.js";
import { renderGenerateSprites }    from "./steps/generate-sprites.js";
import { renderPreviewGame }        from "./steps/preview-game.js";
import { renderCustomize }          from "./steps/customize.js";
import { renderPublish }            from "./steps/publish.js";
import { renderGallery }            from "./steps/gallery.js";

export type Step =
  | "welcome" | "pick-game" | "upload-drawing" | "upload-background"
  | "describe-character" | "generate-sprites" | "preview-game"
  | "customize" | "publish" | "gallery";

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
  backgroundUrl: string | null;
  characterDescription: CharacterDescription | null;
  spriteVersions: SpriteVersion[];
  activeSpriteVersionId: string | null;
  soundAssignments: Record<string, string>;
  published: boolean;
  currentStep: Step;
}

const PROGRESS_STEPS: Step[] = [
  "pick-game", "upload-drawing", "upload-background",
  "describe-character", "generate-sprites", "preview-game",
  "customize", "publish",
];

const STEP_LABELS: Partial<Record<Step, string>> = {
  "pick-game":          "Pick Game",
  "upload-drawing":     "Drawing",
  "upload-background":  "Background",
  "describe-character": "Describe",
  "generate-sprites":   "AI Magic",
  "preview-game":       "Play",
  "customize":          "Sounds",
  "publish":            "Publish",
};

const state: SessionState = {
  sessionId:            new URLSearchParams(location.search).get("s") ?? "demo",
  sessionConfig:        null,
  childId:              null,
  childName:            null,
  gameType:             null,
  drawingUrl:           null,
  drawingBase64:        null,
  backgroundUrl:        null,
  characterDescription: null,
  spriteVersions:       [],
  activeSpriteVersionId: null,
  soundAssignments:     {},
  published:            false,
  currentStep:          "welcome",
};

export function goToStep(step: Step, update: Partial<SessionState> = {}) {
  Object.assign(state, update, { currentStep: step });
  render();
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // Progress bar — done dots are clickable buttons, others are plain divs
  const idx = PROGRESS_STEPS.indexOf(state.currentStep);
  if (idx !== -1) {
    const bar  = document.createElement("div");
    bar.className = "progress-bar";
    const row  = document.createElement("div");
    row.className = "progress__dots";

    PROGRESS_STEPS.forEach((step, i) => {
      const done = i < idx;
      const dot  = document.createElement(done ? "button" : "div") as HTMLElement;
      dot.className = `progress__dot progress__dot--${done ? "done" : i === idx ? "active" : "upcoming"}`;
      if (done) {
        (dot as HTMLButtonElement).title = STEP_LABELS[step] ?? step;
        dot.addEventListener("click", () => goToStep(step));
      }
      row.appendChild(dot);
    });

    bar.appendChild(row);
    app.appendChild(bar);
  }

  const wrap = document.createElement("div");
  wrap.className = "step-wrap";
  app.appendChild(wrap);

  const handlers: Record<Step, (el: HTMLElement, s: SessionState, go: typeof goToStep) => void> = {
    "welcome":             renderWelcome,
    "pick-game":           renderPickGame,
    "upload-drawing":      renderUploadDrawing,
    "upload-background":   renderUploadBackground,
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
