import { defineConfig } from "vite";
import { resolve } from "node:path";
const base = process.env.DEMO_BASE_PATH || "/";
export default defineConfig({
  base,
  publicDir: "../web/public",
  resolve: {
    alias: {
      "@": resolve(__dirname, "../web/src"),
      "next/link": resolve(__dirname, "src/shims/link.tsx"),
      "next/navigation": resolve(__dirname, "src/shims/navigation.ts"),
      "next/dynamic": resolve(__dirname, "src/shims/dynamic.tsx"),
      "next/image": resolve(__dirname, "src/shims/image.tsx"),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      name: "demo-public-paths",
      enforce: "pre",
      transform(code, id) {
        const file = id.replaceAll("\\", "/");
        if (file.endsWith("/components/navigation-trail.tsx")) {
          code =
            "const __demoRouteBase=" +
            JSON.stringify(base.replace(/\/$/, "")) +
            ";\n" +
            code
              .replaceAll(
                "location.pathname + location.search + location.hash",
                "(location.pathname.slice(__demoRouteBase.length)||'/') + location.search + location.hash",
              )
              .replaceAll("golden-navigation-trail-v1", "golden-navigation-trail-v1:" + base);
        }

        if (file.endsWith("/components/voice-note.tsx"))
          return { code: "export function VoiceNote(){return null}", map: null };
        if (file.endsWith("/components/ask-journal.tsx"))
          return { code: "export function AskJournal(){return null}", map: null };
        if (!id.includes("/web/src/") && !id.includes("\\web\\src\\")) return;
        return {
          code: code
            .replace(/["']use client["'];?/g, "")
            .replace(/\b(?:window\.)?localStorage\b/g, "window.__goldenDemoStorage")
            .replaceAll("/journal/archive", "/notebook")
            .replaceAll("Архив старых заметок", "Открыть заметки")
            .replace(
              /(["'`])\/(brand|icons|covers|fonts)\//g,
              (_m, q, folder) => q + base + folder + "/",
            ),
          map: null,
        };
      },
    },
  ],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes("use client"))
          return;
        warn(warning);
      },
    },
  },
});
