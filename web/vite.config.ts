import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // The data artifacts in public/ are already content-hashed by the pipeline;
    // Vite hashes the bundle. Everything served from /assets and /data is
    // therefore immutable, which is what render.yaml's cache headers assume.
    assetsDir: "assets",
    sourcemap: true,
    rollupOptions: {
      output: {
        // d3 primitives change far less often than the app does, so give the
        // reader a long-lived cache entry for them.
        manualChunks(id: string) {
          if (id.includes("node_modules/d3-")) return "d3";
          return undefined;
        },
      },
    },
  },
});
