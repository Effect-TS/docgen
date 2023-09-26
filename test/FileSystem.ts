import * as PlatformFileSystem from "@effect/platform-node/FileSystem"
import * as assert from "assert"
import { Effect, Exit } from "effect"
import * as FileSystem from "../src/FileSystem"

describe.concurrent("FileSystem", () => {
  describe.concurrent("readFile", () => {
    it("should error out on non existing files", async () => {
      const program = Effect.flatMap(
        FileSystem.FileSystem,
        (fileSystem) => fileSystem.readFile("non-existent.txt")
      ).pipe(
        Effect.mapError(({ error }) => error.message),
        Effect.provide(FileSystem.FileSystemLive),
        Effect.provide(PlatformFileSystem.layer)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.fail("ENOENT: no such file or directory, open 'non-existent.txt'")
      )
    })
  })
})
