import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Effect from "@effect/io/Effect"
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
        await Effect.runPromiseEither(program),
        Either.left("ENOENT: no such file or directory, open 'non-existent.txt'")
      )
    })
  })
})
