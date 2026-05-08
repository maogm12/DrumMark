import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/DrumMark/",
  appType: "mpa",
  optimizeDeps: {
    force: true,
  },
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
   build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        docs: resolve(__dirname, "docs.html"),
        docs_zh: resolve(__dirname, "docs_zh.html"),
      },
      output: {
        manualChunks: {
          vexflow: ["vexflow/bravura"],
          codemirror: ["@codemirror/state", "@codemirror/view", "@codemirror/commands", "@codemirror/lint"],
        },
      },
    },
  },
});
