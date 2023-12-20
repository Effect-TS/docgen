import * as Command from "@effect/cli/Command"
import * as CLI from "@effect/docgen/CLI"
import * as Configuration from "@effect/docgen/Configuration"
import { DocgenError } from "@effect/docgen/Error"
import * as Process from "@effect/docgen/Process"
import * as CommandExecutor from "@effect/platform-node/CommandExecutor"
import * as Error from "@effect/platform-node/Error"
import * as FileSystem from "@effect/platform-node/FileSystem"
import * as Path from "@effect/platform-node/Path"
import * as Terminal from "@effect/platform-node/Terminal"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { hole } from "effect/Function"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as String from "effect/String"
import { assert, describe, it } from "vitest"

interface DocgenJson extends Record<string, unknown> {}

const DocgenJson = Context.Tag<DocgenJson>()

const makeDocgenJson = (config: Record<string, unknown>) => Layer.succeed(DocgenJson, config)

const TestFileSystem = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)

    const docgenJson = yield* _(
      Effect.contextWith((context: Context.Context<never>) =>
        Option.getOrElse(Context.getOption(context, DocgenJson), () => ({} as DocgenJson))
      )
    )

    const readFileString: FileSystem.FileSystem["readFileString"] = (filePath) => {
      const fileName = path.basename(filePath)
      if (fileName === "package.json") {
        return Effect.succeed(JSON.stringify({ name: "name", homepage: "homepage" }))
      } else if (fileName === "docgen.json") {
        return Effect.succeed(JSON.stringify(docgenJson))
      } else {
        return Effect.fail(Error.BadArgument({
          method: "readFileString",
          module: "FileSystem",
          message: `file not found: ${path}`
        }))
      }
    }

    const exists: FileSystem.FileSystem["exists"] = (filePath) =>
      Effect.succeed(path.basename(filePath) === "docgen.json")

    return FileSystem.FileSystem.of({
      access: hole,
      chmod: hole,
      chown: hole,
      copy: hole,
      copyFile: hole,
      exists,
      link: hole,
      makeDirectory: hole,
      makeTempDirectory: hole,
      makeTempDirectoryScoped: hole,
      makeTempFile: hole,
      makeTempFileScoped: hole,
      open: hole,
      readDirectory: hole,
      readFile: hole,
      readFileString,
      readLink: hole,
      realPath: hole,
      remove: hole,
      rename: hole,
      sink: hole,
      stat: hole,
      stream: hole,
      symlink: hole,
      truncate: hole,
      utimes: hole,
      writeFile: hole,
      writeFileString: hole
    })
  })
).pipe(Layer.provide(Path.layer))

const TestLive = Configuration.configProviderLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(
    CommandExecutor.layer.pipe(Layer.provide(TestFileSystem)),
    Path.layer,
    Process.layer,
    Terminal.layer,
    TestFileSystem
  ))
)

const testCliFor = (program: Effect.Effect<Configuration.Configuration, never, void>) =>
  CLI.docgenCommand.pipe(
    Command.withHandler(() => program),
    Command.provideEffect(Configuration.Configuration, (args) => Configuration.load(args)),
    Command.run({ name: "docgen", version: "v1.0.0" })
  )

describe("Configuration", () => {
  it("should use the default configuration if no configuration is provided", () => {
    const program = Effect.gen(function*(_) {
      const config = yield* _(Configuration.Configuration)
      assert.deepStrictEqual(config, {
        projectName: "name",
        projectHomepage: "homepage",
        srcDir: "src",
        outDir: "docs",
        theme: "mikearnaldi/just-the-docs",
        enableSearch: true,
        enforceDescriptions: false,
        enforceExamples: false,
        enforceVersion: true,
        runExamples: true,
        exclude: [],
        parseCompilerOptions: Configuration.defaultCompilerOptions,
        examplesCompilerOptions: Configuration.defaultCompilerOptions
      })
    })
    const cli = testCliFor(program)
    return cli([]).pipe(
      Effect.provide(TestLive),
      Effect.runPromise
    )
  })

  it("should use the configuration contained in docgen.json if it exists", () => {
    const parseCompilerOptions = {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      exactOptionalPropertyTypes: true,
      moduleResolution: "Bundler",
      target: "ES2022",
      lib: ["ES2022", "DOM"]
    }
    const program = Effect.gen(function*(_) {
      const config = yield* _(Configuration.Configuration)
      assert.deepStrictEqual(config, {
        projectName: "name",
        projectHomepage: "myproject",
        srcDir: "src",
        outDir: "docs",
        theme: "mikearnaldi/just-the-docs",
        enableSearch: true,
        enforceDescriptions: false,
        enforceExamples: false,
        enforceVersion: true,
        runExamples: true,
        exclude: [],
        parseCompilerOptions,
        examplesCompilerOptions: Configuration.defaultCompilerOptions
      })
    })
    const cli = testCliFor(program)
    return cli([]).pipe(
      Effect.provide(TestLive.pipe(Layer.provide(
        makeDocgenJson({
          projectHomepage: "myproject",
          parseCompilerOptions
        })
      ))),
      Effect.runPromise
    )
  })

  it("should raise a validation error if docgen.json is not valid", async () => {
    const cli = testCliFor(Effect.unit)
    const result = await cli([]).pipe(
      Effect.provide(TestLive.pipe(Layer.provide(makeDocgenJson({ projectHomepage: 1 })))),
      Effect.runPromiseExit
    )
    assert.deepStrictEqual(
      result,
      Exit.die(
        new DocgenError({
          message: String.stripMargin(
            `|[Configuration.validateJsonFile]
             |error(s) found
             |└─ ["projectHomepage"]
             |   └─ Expected string, actual 1`
          )
        })
      )
    )
  })
})
