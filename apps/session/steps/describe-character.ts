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

function chips(group: string, options: typeof WHAT): string {
  return `<div class="chip-group" data-group="${group}">
    ${options.map(o => `
      <button class="chip" data-group="${group}" data-value="${o.v}">
        <span class="chip__emoji">${o.e}</span>
        <span class="chip__label">${o.l}</span>
      </button>
    `).join("")}
    <input class="chip-custom" data-group="${group}" type="text"
      placeholder="or type your own..." maxlength="40" />
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

      <div class="sentence-preview" id="sentence-preview" hidden>
        <p class="sentence-preview__text" id="preview-text"></p>
      </div>

      <button class="btn btn--primary btn--big" id="next-btn" disabled>Ask the AI! ✨</button>
    </div>
  `;

  const sel: Record<string, string> = { what: "", feeling: "", movement: "" };
  const nextBtn    = container.querySelector<HTMLButtonElement>("#next-btn")!;
  const previewBox = container.querySelector<HTMLElement>("#sentence-preview")!;
  const previewTxt = container.querySelector<HTMLElement>("#preview-text")!;

  function refresh() {
    const allFilled = Object.values(sel).every((v) => v.trim().length > 0);
    nextBtn.disabled = !allFilled;
    if (allFilled) {
      previewBox.hidden = false;
      previewTxt.textContent = `A ${sel.feeling} ${sel.what} that moves in a ${sel.movement} way`;
    } else {
      previewBox.hidden = true;
    }
  }

  container.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.dataset.group!;
      container.querySelectorAll<HTMLButtonElement>(`.chip[data-group="${group}"]`)
        .forEach((c) => c.classList.remove("chip--active"));
      (container.querySelector<HTMLInputElement>(`.chip-custom[data-group="${group}"]`)!).value = "";
      chip.classList.add("chip--active");
      sel[group] = chip.dataset.value!;
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
    goToStep("generate-sprites", {
      characterDescription: sel as CharacterDescription,
    });
  });
}
