import * as FileSystem from "@effect/docgen/FileSystem"
import * as PlatformFileSystem from "@effect/platform-node/FileSystem"
import * as assert from "assert"
import { Effect, Exit } from "effect"

const isBun = "Bun" in globalThis

describe("FileSystem", () => {
  describe("readFile", () => {
    it("should error out on non existing files", async () => {
      const program = Effect.flatMap(
        FileSystem.FileSystem,
        (fileSystem) => fileSystem.readFile("non-existent.txt")
      ).pipe(
        Effect.mapError((error) => error.message),
        Effect.provide(FileSystem.FileSystemLive),
        Effect.provide(PlatformFileSystem.layer)
      )
      assert.deepStrictEqual(
        await Effect.runPromiseExit(program),
        Exit.fail(
          isBun ?
            `[FileSystem] Unable to read file from 'non-existent.txt': No such file or directory` :
            `[FileSystem] Unable to read file from 'non-existent.txt': ENOENT: no such file or directory, open 'non-existent.txt'`
        )
      )
    })
  })
})
