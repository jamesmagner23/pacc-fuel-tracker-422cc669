import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), {
    name: "entry-size-report",
    apply: "build" as const,
    generateBundle(_options, bundle) {
      const entries = Object.values(bundle).filter(item => item.type === "chunk" && item.isEntry).map(item => {
        if (item.type !== "chunk") return null;
        return { file: item.fileName, bytes: Buffer.byteLength(item.code), gzip_bytes: gzipSync(item.code).length, imports: item.imports };
      }).filter(Boolean);
      writeFileSync("/tmp/batch4-size-after.json", JSON.stringify(entries));
      console.info("Entry size report:", JSON.stringify(entries));
    },
  }].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
