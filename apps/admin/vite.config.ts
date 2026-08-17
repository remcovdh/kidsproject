import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    proxy: {
      "/api/":     "http://localhost:3002",
      "/uploads/": "http://localhost:3002",
    },
  },
});
