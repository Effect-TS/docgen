import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as assert from "assert"
import * as FileSystem from "../src/FileSystem"

describe.concurrent("FileSystem", () => {
  describe.concurrent("readFile", () => {
    it("should error out on non existing files", async () => {
      const program = pipe(
        Effect.flatMap(
          FileSystem.FileSystem,
          (fileSystem) => fileSystem.readFile("non-existent.txt")
        ),
        Effect.mapError(({ error }) => error.message),
        Effect.provideLayer(FileSystem.FileSystemLive)
      )
      assert.deepStrictEqual(
        Exit.unannotate(await Effect.runPromiseExit(program)),
        Exit.fail("ENOENT: no such file or directory, open 'non-existent.txt'")
      )
    })
  })
})
