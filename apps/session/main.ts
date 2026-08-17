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
  styleMode: "shape" | "copy";
  artStyle: string; // "" when styleMode === "copy"
}

export interface SessionState {
  sessionId: string;
  sessionConfig: SessionConfig | null;
  childId: string | null;
  childName: string | null;
  childDisplayCode: string | null;
  gameType: "catcher" | "jumper" | null;
  drawingUrl: string | null;
  backgroundUrl: string | null;
  characterDescription: CharacterDescription | null;
  spriteVersions: SpriteVersion[];
  activeSpriteVersionId: string | null;
  soundAssignments: Record<string, string>;
  published: boolean;
  currentStep: Step;
  previewContext: "character" | "background" | "sounds";
}

type Phase = "character" | "world" | "sounds" | "share";

const PHASES: { id: Phase; label: string; steps: Step[] }[] = [
  { id: "character", label: "Character", steps: ["pick-game", "upload-drawing", "describe-character", "generate-sprites"] },
  { id: "world",      label: "World",     steps: ["upload-background"] },
  { id: "sounds",     label: "Sounds",    steps: ["customize"] },
  { id: "share",      label: "Share",     steps: ["publish"] },
];

function currentPhaseIndex(state: SessionState): number {
  if (state.currentStep === "preview-game") {
    if (state.previewContext === "background") return 1;
    if (state.previewContext === "sounds")      return 2;
    return 0;
  }
  return PHASES.findIndex((p) => p.steps.includes(state.currentStep));
}

const state: SessionState = {
  sessionId:            new URLSearchParams(location.search).get("s") ?? "demo",
  sessionConfig:        null,
  childId:              null,
  childName:            null,
  childDisplayCode:     null,
  gameType:             null,
  drawingUrl:           null,
  backgroundUrl:        null,
  characterDescription: null,
  spriteVersions:       [],
  activeSpriteVersionId: null,
  soundAssignments:     {},
  published:            false,
  // A shared "?view=gallery" link (see steps/gallery.ts's share button) lands directly on the
  // gallery — no name/registration needed, since anyone with the link is just there to watch,
  // not to make a game.
  currentStep:          new URLSearchParams(location.search).get("view") === "gallery" ? "gallery" : "welcome",
  previewContext:       "character",
};

export function goToStep(step: Step, update: Partial<SessionState> = {}) {
  Object.assign(state, update, { currentStep: step });
  render();
}

function render() {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  // Progress bar — done dots are clickable buttons, others are plain divs
  const idx = currentPhaseIndex(state);
  if (idx !== -1) {
    const bar  = document.createElement("div");
    bar.className = "progress-bar";
    const row  = document.createElement("div");
    row.className = "progress__dots";

    PHASES.forEach((phase, i) => {
      const done = i < idx;
      const dot  = document.createElement(done ? "button" : "div") as HTMLElement;
      dot.className = `progress__dot progress__dot--${done ? "done" : i === idx ? "active" : "upcoming"}`;
      if (done) {
        (dot as HTMLButtonElement).title = phase.label;
        dot.addEventListener("click", () => goToStep(phase.steps[0]));
      }
      row.appendChild(dot);
    });

    bar.appendChild(row);
    app.appendChild(bar);
  }

  // Persistent code badge — kids reference this to identify themselves to a helper
  // on the waiting-for-photo screens, and it disambiguates same-named kids on the
  // teacher's roster since no character/photo exists yet at registration time.
  if (state.childDisplayCode && state.currentStep !== "welcome") {
    const badge = document.createElement("div");
    badge.className = "display-code-badge";
    badge.textContent = state.childDisplayCode;
    app.appendChild(badge);
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
