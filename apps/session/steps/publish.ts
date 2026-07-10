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
      <div id="publish-hero-slot"></div>
      <p class="step__subtitle" id="publish-subtitle"></p>
      <div class="step__actions">
        <button class="btn btn--ghost" id="back-btn">← Go back</button>
        <button class="btn btn--primary btn--big" id="publish-btn">Yes, put it on the wall! 🎉</button>
      </div>
    </div>
  `;

  if (version) {
    const img = document.createElement("img");
    img.className = "publish-hero";
    img.src = version.sprites.celebrate;
    img.alt = "Your character celebrating";
    container.querySelector("#publish-hero-slot")!.replaceWith(img);
  }

  container.querySelector<HTMLElement>("#publish-subtitle")!.textContent =
    `${state.childName}'s game will appear in the gallery so everyone can play it!`;

  container.querySelector("#back-btn")?.addEventListener("click", () => goToStep("customize"));

  container.querySelector("#publish-btn")?.addEventListener("click", async () => {
    const btn = container.querySelector<HTMLButtonElement>("#publish-btn")!;
    btn.disabled = true;
    btn.textContent = "Publishing... 🎈";
    try {
      await publishGame(
        state.childId ?? "anon",
        state.activeSpriteVersionId ?? "",
        state.soundAssignments,
        state.backgroundUrl,
        {
          childName: state.childName ?? "You",
          sprites:   version?.sprites ?? { idle: "", move: "", celebrate: "", collectible: "" },
        }
      );
      goToStep("gallery", { published: true });
    } catch {
      btn.disabled = false;
      btn.textContent = "Yes, put it on the wall! 🎉";
    }
  });
}
