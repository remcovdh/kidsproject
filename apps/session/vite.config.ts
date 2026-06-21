import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

const GAMES_DIR = path.resolve(__dirname, "../games");

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api/":     "http://localhost:3002",
      "/uploads/": "http://localhost:3002",
    },
  },
  plugins: [
    {
      // Serve apps/games/** at /games/** from the same origin as the session app.
      // This lets the game iframe share localStorage and receive postMessages.
      name: "serve-games",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith("/games/")) return next();
          const rel = req.url.slice("/games/".length) || "index.html";
          const file = path.join(GAMES_DIR, rel);
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            const idx = path.join(file, "index.html");
            if (fs.existsSync(idx)) {
              res.setHeader("Content-Type", "text/html");
              fs.createReadStream(idx).pipe(res);
              return;
            }
            return next();
          }
          const mime: Record<string, string> = {
            ".html": "text/html",
            ".js":   "application/javascript",
            ".css":  "text/css",
            ".png":  "image/png",
            ".jpg":  "image/jpeg",
            ".mp3":  "audio/mpeg",
            ".svg":  "image/svg+xml",
          };
          res.setHeader("Content-Type", mime[path.extname(file)] ?? "application/octet-stream");
          fs.createReadStream(file).pipe(res);
        });
      },
    },
  ],
});
