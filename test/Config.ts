import * as Config from "@effect/docgen/Config"
import * as FileSystem from "@effect/docgen/FileSystem"
import * as Process from "@effect/docgen/Process"
import { Path } from "@effect/platform-node"
import { Effect, Either, hole, Layer } from "effect"
import { assert, describe, it } from "vitest"

describe("Config", () => {
  const fakePackageJson = { name: "name", homepage: "homepage" }

  it(`should return the default config if docgen.json doesn't exists`, () => {
    const program = Effect.gen(function*(_) {
      const config = yield* _(Config.Config)
      assert.deepStrictEqual(
        config,
        Config.getDefaultConfig(fakePackageJson.name, fakePackageJson.homepage)
      )
    })

    const FileSystemTest = Layer.succeed(
      FileSystem.FileSystem,
      FileSystem.FileSystem.of({
        readFile: () => Effect.succeed(JSON.stringify(fakePackageJson)),
        writeFile: hole,
        removeFile: hole,
        exists: () => Effect.succeed(false),
        glob: hole
      })
    )

    return program.pipe(
      Effect.provide(Config.ConfigLive),
      Effect.provide(Process.ProcessLive),
      Effect.provide(Path.layer),
      Effect.provide(FileSystemTest),
      Effect.runPromise
    )
  })

  it(`should return the config contained in docgen.json`, () => {
    const docgen = { projectHomepage: "myproject" }

    const program = Effect.gen(function*(_) {
      const config = yield* _(Config.Config)
      assert.deepStrictEqual(config, {
        ...Config.getDefaultConfig(fakePackageJson.name, fakePackageJson.homepage),
        ...docgen
      })
    })

    const FileSystemTest = Layer.effect(
      FileSystem.FileSystem,
      Effect.map(Path.Path, (_) =>
        FileSystem.FileSystem.of({
          readFile: (path) => {
            const fileName = _.basename(path)
            if (fileName === "package.json") {
              return Effect.succeed(JSON.stringify(fakePackageJson))
            } else if (fileName === "docgen.json") {
              return Effect.succeed(JSON.stringify(docgen))
            } else {
              return Effect.fail(new Error(`file not found: ${path}`))
            }
          },
          writeFile: hole,
          removeFile: hole,
          exists: (path) => {
            return Effect.succeed(_.basename(path) === "docgen.json")
          },
          glob: hole
        }))
    )

    return program.pipe(
      Effect.provide(Config.ConfigLive),
      Effect.provide(Process.ProcessLive),
      Effect.provide(Path.layer),
      Effect.provide(FileSystemTest.pipe(Layer.use(Path.layer))),
      Effect.runPromise
    )
  })

  it(`should raise a validation error if docgen.json is not valid`, () => {
    const docgen = { projectHomepage: 1 }

    const FileSystemTest = Layer.effect(
      FileSystem.FileSystem,
      Effect.map(Path.Path, (_) =>
        FileSystem.FileSystem.of({
          readFile: (path) => {
            const fileName = _.basename(path)
            if (fileName === "package.json") {
              return Effect.succeed(JSON.stringify(fakePackageJson))
            } else if (fileName === "docgen.json") {
              return Effect.succeed(JSON.stringify(docgen))
            } else {
              return Effect.fail(new Error(`file not found: ${path}`))
            }
          },
          writeFile: hole,
          removeFile: hole,
          exists: (path) => {
            return Effect.succeed(_.basename(path) === "docgen.json")
          },
          glob: hole
        }))
    )

    return Effect.unit.pipe(
      Effect.provide(Config.ConfigLive),
      Effect.provide(Process.ProcessLive),
      Effect.provide(Path.layer),
      Effect.provide(FileSystemTest.pipe(Layer.use(Path.layer))),
      Effect.either,
      Effect.runPromise
    ).then((result) => {
      assert.deepStrictEqual(
        result.pipe(Either.reverse, Either.map((error) => error.message), Either.getOrThrow),
        `[Config] Invalid config:
error(s) found
└─ ["projectHomepage"]
   └─ Expected string, actual 1`
      )
    })
  })
})
