import OpenAI from "openai";
import sharp from "sharp";
import type { ServerAiProvider, SpriteBuffers, SpriteFile } from "./index.js";

const POSE_PROMPTS: Record<Exclude<keyof SpriteBuffers, "collectible">, string> = {
  idle:      "standing still, relaxed, neutral upright pose, arms at sides",
  move:      "running or sliding sideways, dynamic movement, legs in mid-stride, facing and moving toward the RIGHT",
  celebrate: "cheering with both arms raised in victory, mouth open in a big smile",
};

// Order the 3 poses appear left-to-right in the generated sprite sheet.
const SHEET_POSE_ORDER: Array<Exclude<keyof SpriteBuffers, "collectible">> = ["idle", "move", "celebrate"];
const PANEL_SIZE = 512;

const provider: ServerAiProvider = {
  async generateSprites(description: string, drawingBase64: string, styleMode?: "shape" | "copy", artStyle?: string): Promise<SpriteBuffers> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Analyze the drawing — focus varies by mode
    let characterSheet = description;
    if (drawingBase64) {
      const visionPrompt = styleMode === "copy"
        ? `A child drew this game character. Write a short CHARACTER SHEET: list the exact colors, body shape, face features, and any distinctive details (wings, hat, tail, etc.). Be specific so an illustrator could recreate it identically — including the rough childlike style and coloring. The child calls it: "${description}".`
        : `A child drew this game character. Describe its SHAPE and STRUCTURE only: body proportions, silhouette, number of limbs, and distinctive physical features (wings, hat, tail, ears, horns, etc.). Do NOT mention colors or art style — focus purely on shape so an illustrator could recreate the form. The child calls it: "${description}".`;
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: visionPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${drawingBase64}`, detail: "low" } },
            ],
          }],
        });
        characterSheet = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis failed, using text description:", err);
      }
    }

    const styleInstruction = styleMode === "copy"
      ? "Preserve the EXACT childlike art style, rough hand-drawn quality, and original colors from the drawing. Do not clean up or professionalize the look — keep it looking like the child's own style."
      : `Render as a clean ${artStyle ?? "cartoon"} game sprite. Use the character's SHAPE and distinctive features from the drawing, but apply a fresh ${artStyle ?? "cartoon"} art style with bold outlines and bright colors. Do NOT copy the drawing's coloring or rough style.`;

    // Generate all 3 character poses as ONE sprite-sheet image (instead of 3 independent
    // calls) so the poses stay visually consistent with each other — same colors, shape,
    // and proportions — then crop the sheet into 3 separate sprite files. The collectible
    // has no pose-consistency requirement, so it stays a separate call, run in parallel.
    const sheetPrompt =
      `2D video game character sprite sheet, exactly 3 square panels arranged left-to-right ` +
      `in the TOP HALF of the image only (a 3-panel comic-strip layout), each panel ${PANEL_SIZE}x${PANEL_SIZE}, ` +
      `with the bottom half of the image left blank/transparent. ` +
      `CHARACTER (keep IDENTICAL across all 3 panels — same shape, colors, face, and design): ${characterSheet}. ` +
      `STYLE: ${styleInstruction} ` +
      `PANEL 1 (leftmost): ${POSE_PROMPTS.idle}. ` +
      `PANEL 2 (middle): ${POSE_PROMPTS.move}. ` +
      `PANEL 3 (rightmost): ${POSE_PROMPTS.celebrate}. ` +
      `Transparent background, no text, no watermark, no panel numbers/labels, PNG.`;

    const [poseEntries, collectibleFile] = await Promise.all([
      (async () => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt: sheetPrompt,
          size: "1536x1024",
          quality: "medium",
          background: "transparent",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for sprite sheet");
        const sheetBuffer = Buffer.from(b64, "base64");

        return Promise.all(SHEET_POSE_ORDER.map(async (pose, i) => {
          const cropped = await sharp(sheetBuffer)
            .extract({ left: i * PANEL_SIZE, top: 0, width: PANEL_SIZE, height: PANEL_SIZE })
            .png()
            .toBuffer();
          return [pose, { data: cropped, ext: "png" }] as const;
        }));
      })(),

      (async (): Promise<SpriteFile> => {
        const response = await client.images.generate({
          model: "gpt-image-1",
          prompt:
            `A single small collectible item for a children's video game. ` +
            `It should be something that thematically matches this character: ${characterSheet}. ` +
            `Examples: a glowing gem, a golden star, a treat, a magical orb. ` +
            `Simple 2D, bright cheerful colors, transparent background, centered, no text, PNG.`,
          size: "1024x1024",
          quality: "medium",
          background: "transparent",
          n: 1,
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) throw new Error("No image data returned for collectible");
        return { data: Buffer.from(b64, "base64"), ext: "png" };
      })(),
    ]);

    return {
      ...Object.fromEntries(poseEntries),
      collectible: collectibleFile,
    } as unknown as SpriteBuffers;
  },

  async generateBackground(description: string, imageBase64?: string, styleDescription?: string): Promise<SpriteFile> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let sceneDescription = description;

    if (imageBase64) {
      try {
        const analysis = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 120,
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `A child drew this and wants to use it as inspiration for a video game background. Describe the scene in 1-2 sentences for an illustrator — focus on setting, mood, and colors.${description ? ` The child also described it as: "${description}".` : ""}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "low" },
              },
            ],
          }],
        });
        sceneDescription = analysis.choices[0]?.message?.content ?? description;
      } catch (err) {
        console.warn("GPT-4o Vision analysis for background failed:", err);
      }
    }

    const styleClause = styleDescription
      ? ` Art style should match this character: ${styleDescription}.`
      : "";

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt:
        `A tall portrait-orientation background for a children's video game (taller than wide, like a phone screen). Scene: ${sceneDescription}.${styleClause} ` +
        `Sky fills the top half, ground or scenery at the bottom. Colorful, cheerful, childlike art style. ` +
        `No characters, no text, just the scenery. Flat 2D illustration style, vibrant colors, bold shapes.`,
      size: "1024x1536",
      quality: "medium",
      n: 1,
    });
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned for background");
    return { data: Buffer.from(b64, "base64"), ext: "png" };
  },
};

export default provider;
