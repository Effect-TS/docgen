import * as FileSystem from "@effect/docgen/FileSystem"
import { Effect, Exit } from "effect"
import { assert, describe, it } from "vitest"

const isBun = "Bun" in globalThis

describe("FileSystem", () => {
  describe("readFile", () => {
    it("should error out on non existing files", async () => {
      const path = `${__dirname}/fixtures/non-existent.txt`
      const program = FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.readFile(path)),
        Effect.mapError((error) => error.message),
        Effect.provide(FileSystem.FileSystemLive)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.fail(
          isBun ?
            `[FileSystem] Unable to read file from '${path}': No such file or directory` :
            `[FileSystem] Unable to read file from '${path}': ENOENT: no such file or directory, open '${path}'`
        )
      )
    })
  })

  describe("readJsonFile", () => {
    it("should error out on invalid json files", async () => {
      const path = `${__dirname}/fixtures/invalid-json.txt`
      const program = FileSystem.readJsonFile(path).pipe(
        Effect.mapError((error) => error.message),
        Effect.provide(FileSystem.FileSystemLive)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.fail(
          `[FileSystem] Unable to read and parse JSON file from '${path}': SyntaxError: Expected property name or '}' in JSON at position 1`
        )
      )
    })
  })

  describe("glob", () => {
    it("should return an array of paths", async () => {
      const program = FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.glob("src/**/*.ts")),
        Effect.map((files) => files.sort()),
        Effect.provide(FileSystem.FileSystemLive)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.succeed([
          "src/CommandExecutor.ts",
          "src/Config.ts",
          "src/Core.ts",
          "src/Domain.ts",
          "src/FileSystem.ts",
          "src/Logger.ts",
          "src/Markdown.ts",
          "src/Parser.ts",
          "src/Process.ts",
          "src/bin.ts"
        ])
      )
    })

    it("should ignore the provided `exclude` patterns", async () => {
      const program = FileSystem.FileSystem.pipe(
        Effect.flatMap((fs) => fs.glob("src/**/*.ts", ["src/bin.ts"])),
        Effect.map((files) => files.sort()),
        Effect.provide(FileSystem.FileSystemLive)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.succeed([
          "src/CommandExecutor.ts",
          "src/Config.ts",
          "src/Core.ts",
          "src/Domain.ts",
          "src/FileSystem.ts",
          "src/Logger.ts",
          "src/Markdown.ts",
          "src/Parser.ts",
          "src/Process.ts"
        ])
      )
    })
  })

  it("writeFile + exists + removeFile", async () => {
    const path = `${__dirname}/fixtures/file.txt`
    const program = Effect.gen(function*(_) {
      const fs = yield* _(FileSystem.FileSystem)
      const b1 = yield* _(fs.exists(path))
      yield* _(fs.writeFile(path, ""))
      const b2 = yield* _(fs.exists(path))
      yield* _(fs.removeFile(path))
      const b3 = yield* _(fs.exists(path))
      return [b1, b2, b3]
    }).pipe(Effect.provide(FileSystem.FileSystemLive))
    assert.deepStrictEqual(
      await Effect.runPromiseExit(program),
      Exit.succeed([false, true, false])
    )
  })
})
