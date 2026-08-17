import type { SessionState, Step, CharacterDescription } from "../main.js";
import { checkModeration } from "../api.js";

const WHAT = [
  { v: "animal",  l: "Animal",  e: "🦊" },
  { v: "robot",   l: "Robot",   e: "🤖" },
  { v: "monster", l: "Monster", e: "👾" },
  { v: "hero",    l: "Hero",    e: "🦸" },
  { v: "wizard",  l: "Wizard",  e: "🧙" },
  { v: "star",    l: "Star",    e: "🌟" },
];
const FEELING = [
  { v: "happy",   l: "Happy",   e: "😄" },
  { v: "fierce",  l: "Fierce",  e: "😠" },
  { v: "silly",   l: "Silly",   e: "😂" },
  { v: "cute",    l: "Cute",    e: "🥺" },
  { v: "cool",    l: "Cool",    e: "😎" },
  { v: "excited", l: "Excited", e: "🤩" },
];
const MOVEMENT = [
  { v: "bouncy",  l: "Bouncy",  e: "🏀" },
  { v: "floaty",  l: "Floaty",  e: "🌊" },
  { v: "fast",    l: "Fast",    e: "⚡" },
  { v: "slow",    l: "Slow",    e: "🐢" },
  { v: "wobbly",  l: "Wobbly",  e: "🌀" },
  { v: "sneaky",  l: "Sneaky",  e: "🐱" },
];
const STYLE = [
  { v: "cartoon",                 l: "Cartoon",    e: "🎨" },
  { v: "watercolor painting",     l: "Watercolor", e: "🌊" },
  { v: "pixel art",               l: "Pixel",      e: "⚡" },
  { v: "comic book",              l: "Comic",      e: "🦸" },
  { v: "kawaii cute",             l: "Kawaii",     e: "🐱" },
  { v: "children's storybook",    l: "Storybook",  e: "📖" },
  { v: "as-drawn",                l: "As drawn",   e: "✏️" },
];

function chips(group: string, options: typeof WHAT, allowCustom = true): string {
  return `<div class="chip-group" data-group="${group}">
    ${options.map(o => `
      <button class="chip" data-group="${group}" data-value="${o.v}">
        <span class="chip__emoji">${o.e}</span>
        <span class="chip__label">${o.l}</span>
      </button>
    `).join("")}
    ${allowCustom ? `<input class="chip-custom" data-group="${group}" type="text"
      placeholder="or type your own..." maxlength="40" />` : ""}
  </div>`;
}

export function renderDescribeCharacter(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  container.innerHTML = `
    <div class="step step--describe">
      ${state.drawingUrl ? `<img class="drawing-thumb" src="${state.drawingUrl}" alt="Your drawing" />` : ""}
      <h1 class="step__title">Tell us about your character!</h1>

      <div class="describe-block">
        <p class="describe-label">My character is a...</p>
        ${chips("what", WHAT)}
      </div>

      <div class="describe-block">
        <p class="describe-label">It feels...</p>
        ${chips("feeling", FEELING)}
      </div>

      <div class="describe-block">
        <p class="describe-label">It moves...</p>
        ${chips("movement", MOVEMENT)}
      </div>

      <div class="describe-block">
        <p class="describe-label">Draw it as...</p>
        ${chips("style", STYLE, false)}
      </div>

      <div class="sentence-preview" id="sentence-preview" hidden>
        <p class="sentence-preview__text" id="preview-text"></p>
      </div>

      <button class="btn btn--primary btn--big" id="next-btn" disabled>Ask the AI! ✨</button>
    </div>
  `;

  const sel: Record<string, string> = { what: "", feeling: "", movement: "", style: "" };
  const nextBtn    = container.querySelector<HTMLButtonElement>("#next-btn")!;
  const previewBox = container.querySelector<HTMLElement>("#sentence-preview")!;
  const previewTxt = container.querySelector<HTMLElement>("#preview-text")!;

  function refresh() {
    const allFilled = Object.values(sel).every((v) => v.trim().length > 0);
    nextBtn.disabled = !allFilled;
    if (sel.what && sel.feeling && sel.movement) {
      previewBox.hidden = false;
      previewTxt.textContent = `A ${sel.feeling} ${sel.what} that moves in a ${sel.movement} way`;
    } else {
      previewBox.hidden = true;
    }
  }

  function selectChip(group: string, value: string) {
    const chipMatch = container.querySelector<HTMLButtonElement>(
      `.chip[data-group="${group}"][data-value="${value}"]`
    );
    container.querySelectorAll<HTMLButtonElement>(`.chip[data-group="${group}"]`)
      .forEach((c) => c.classList.remove("chip--active"));
    const custom = container.querySelector<HTMLInputElement>(`.chip-custom[data-group="${group}"]`);
    if (chipMatch) {
      chipMatch.classList.add("chip--active");
      if (custom) custom.value = "";
    } else if (custom) {
      custom.value = value;
    }
    sel[group] = value;
  }

  container.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectChip(chip.dataset.group!, chip.dataset.value!);
      refresh();
    });
  });

  container.querySelectorAll<HTMLInputElement>(".chip-custom").forEach((input) => {
    input.addEventListener("input", () => {
      const group = input.dataset.group!;
      container.querySelectorAll<HTMLButtonElement>(`.chip[data-group="${group}"]`)
        .forEach((c) => c.classList.remove("chip--active"));
      sel[group] = input.value.trim();
      refresh();
    });
  });

  // Prefill from a previous attempt (e.g. "Try again" after generation) so a retry
  // doesn't force re-picking all 4 rows from scratch.
  const prev = state.characterDescription;
  if (prev) {
    selectChip("what", prev.what);
    selectChip("feeling", prev.feeling);
    selectChip("movement", prev.movement);
    selectChip("style", prev.styleMode === "copy" ? "as-drawn" : prev.artStyle);
    refresh();
  }

  nextBtn.addEventListener("click", async () => {
    nextBtn.disabled = true;
    nextBtn.textContent = "Checking... ⏳";
    const { allowed } = await checkModeration(previewTxt.textContent ?? "");
    if (!allowed) {
      nextBtn.disabled = false;
      nextBtn.textContent = "Ask the AI! ✨";
      alert("Let's describe the character differently — try again!");
      return;
    }
    const styleMode: "shape" | "copy" = sel.style === "as-drawn" ? "copy" : "shape";
    const artStyle = sel.style === "as-drawn" ? "" : sel.style;
    goToStep("generate-sprites", {
      characterDescription: {
        what: sel.what, feeling: sel.feeling, movement: sel.movement,
        styleMode, artStyle,
      } as CharacterDescription,
    });
  });
}
