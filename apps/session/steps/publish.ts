import type { SessionState, Step } from "../main.js";
import { publishGame } from "../api.js";

export function renderPublish(
  container: HTMLElement,
  state: SessionState,
  goToStep: (step: Step, update?: Partial<SessionState>) => void
) {
  const version = state.spriteVersions.find((v) => v.id === state.activeSpriteVersionId);

  container.innerHTML = `
    <div class="step step--publish">
      <h1 class="step__title">Ready to show everyone? 🚀</h1>
      ${version ? `<img class="publish-hero" src="${version.sprites.celebrate}" alt="Your character celebrating" />` : ""}
      <p class="step__subtitle">${state.childName}'s game will appear in the gallery so everyone can play it!</p>
      <div class="step__actions">
        <button class="btn btn--ghost" id="back-btn">← Go back</button>
        <button class="btn btn--primary btn--big" id="publish-btn">Yes, put it on the wall! 🎉</button>
      </div>
    </div>
  `;

  container.querySelector("#back-btn")?.addEventListener("click", () => goToStep("customize"));

  container.querySelector("#publish-btn")?.addEventListener("click", async () => {
    const btn = container.querySelector<HTMLButtonElement>("#publish-btn")!;
    btn.disabled = true;
    btn.textContent = "Publishing... 🎈";
    try {
      await publishGame(
        state.childId ?? "anon",
        state.activeSpriteVersionId ?? "",
        state.soundAssignments
      );
      goToStep("gallery", { published: true });
    } catch {
      btn.disabled = false;
      btn.textContent = "Yes, put it on the wall! 🎉";
    }
  });
}
