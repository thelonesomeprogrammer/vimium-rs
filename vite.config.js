import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      input: {
        content: path.resolve("extension/content.js"),
        background: path.resolve("extension/background.js"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});
