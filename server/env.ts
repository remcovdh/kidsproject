import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env before any other module runs. This file must be the first import
// in index.ts so that dotenv sets process.env before db.ts and routes read it.
// In Docker, vars are already set via env_file in docker-compose.yml and
// dotenv will not override them (override: false is the default).
config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });
