export type GameType = "catcher" | "jumper";

export type AiProvider = "openai" | "gemini";

export interface Session {
  id: string;
  name: string;
  gameType: GameType;
  aiProvider: AiProvider;
  showPrompt: boolean;
  createdAt: string;
}

export interface Child {
  id: string;
  sessionId: string;
  name: string;
  gameType: GameType;
  createdAt: string;
}

export interface SpriteVersion {
  id: string;
  childId: string;
  label: string;
  prompt: string;
  sprites: {
    idle: string;
    move: string;
    action: string;
    celebrate: string;
  };
  createdAt: string;
}

export interface GameState {
  childId: string;
  sessionId: string;
  activeSpriteVersionId: string;
  customizations: {
    sounds: Record<string, string>;
  };
  published: boolean;
}
