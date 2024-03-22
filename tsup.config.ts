import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/bin.ts"],
  clean: true,
  publicDir: true,
  external: ["@parcel/watcher"],
  noExternal: [/(effect|@effect|chalk|tsconfck|ts-morph)/]
})
