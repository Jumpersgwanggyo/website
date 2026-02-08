import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],

  base: "/website/",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // ✅ 이 줄이 핵심
      vue: "vue/dist/vue.esm-bundler.js",
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ["**/node_modules/**"],
    },
  },
});
