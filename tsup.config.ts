import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/bin.ts"],
  clean: true,
  publicDir: true,
  noExternal: [/(effect|@effect|chalk|tsconfck|ts-morph)/]
})
