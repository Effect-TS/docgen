/**
 * @since 1.0.0
 */
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import chalk from "chalk"
import { Context, Effect, Layer, Option } from "effect"
import * as NodePath from "node:path"
import * as tsconfck from "tsconfck"
import * as FileSystem from "./FileSystem"
import * as Process from "./Process"

const PACKAGE_JSON_FILE_NAME = "package.json"
const CONFIG_FILE_NAME = "docgen.json"

/**
 * @category service
 * @since 1.0.0
 */
export interface Config {
  readonly projectName: string
  readonly projectHomepage: string
  readonly srcDir: string
  readonly outDir: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly exclude: ReadonlyArray<string>
  readonly parseCompilerOptions: Record<string, unknown>
  readonly examplesCompilerOptions: Record<string, unknown>
}

/**
 * @category service
 * @since 1.0.0
 */
export const Config = Context.Tag<Config>()

const ConfigSchema = Schema.struct({
  projectHomepage: Schema.string,
  srcDir: Schema.string,
  outDir: Schema.string,
  theme: Schema.string,
  enableSearch: Schema.boolean,
  enforceDescriptions: Schema.boolean,
  enforceExamples: Schema.boolean,
  enforceVersion: Schema.boolean,
  exclude: Schema.array(Schema.string),
  parseCompilerOptions: Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown)),
  examplesCompilerOptions: Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown))
})

const PartialConfigSchema = Schema.partial(ConfigSchema)

const PackageJsonSchema = Schema.struct({
  name: Schema.string,
  homepage: Schema.string
})

const validateJsonFile = <I, A>(
  schema: Schema.Schema<I, A>,
  path: string
): Effect.Effect<FileSystem.FileSystem, Error, A> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const content = yield* _(fs.readJsonFile(path))
    return yield* _(
      Schema.parse(schema)(content),
      Effect.mapError((e) =>
        new Error(`[Config] Invalid config:\n${TreeFormatter.formatErrors(e.errors)}`)
      )
    )
  })

const getDefaultConfig = (projectName: string, projectHomepage: string): Config => ({
  projectName,
  projectHomepage,
  srcDir: "src",
  outDir: "docs",
  theme: "pmarsceill/just-the-docs",
  enableSearch: true,
  enforceDescriptions: false,
  enforceExamples: false,
  enforceVersion: true,
  exclude: [],
  parseCompilerOptions: {},
  examplesCompilerOptions: {}
})

const loadConfig = (
  path: string
): Effect.Effect<
  FileSystem.FileSystem,
  Error,
  Option.Option<Schema.Schema.To<typeof PartialConfigSchema>>
> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const exists = yield* _(fs.pathExists(path))
    if (exists) {
      const config = yield* _(validateJsonFile(PartialConfigSchema, path))
      return Option.some(config)
    } else {
      return Option.none()
    }
  })

/**
 * @category layer
 * @since 1.0.0
 */
export const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function*(_) {
    // Extract the requisite services
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)

    // Read and parse the package.json
    const packageJsonPath = NodePath.join(cwd, PACKAGE_JSON_FILE_NAME)
    const packageJson = yield* _(validateJsonFile(PackageJsonSchema, packageJsonPath))

    // Read and resolve the configuration
    const defaultConfig = getDefaultConfig(packageJson.name, packageJson.homepage)
    const configPath = NodePath.join(cwd, CONFIG_FILE_NAME)
    const maybeConfig = yield* _(loadConfig(configPath))

    if (Option.isNone(maybeConfig)) {
      yield* _(
        Effect.logInfo(chalk.bold("No configuration file detected, using default configuration"))
      )
      return Config.of(defaultConfig)
    }

    yield* _(Effect.logInfo(chalk.bold("Configuration file found")))

    // Allow the user to provide a path to a tsconfig.json file to resolve the compiler options
    const examplesCompilerOptions = yield* _(
      resolveCompilerOptions(cwd, maybeConfig.value.examplesCompilerOptions)
    )
    const parseCompilerOptions = yield* _(
      resolveCompilerOptions(cwd, maybeConfig.value.parseCompilerOptions)
    )

    return Config.of(
      {
        ...defaultConfig,
        ...maybeConfig.value,
        examplesCompilerOptions,
        parseCompilerOptions
      }
    )
  })
)

function resolveCompilerOptions(
  cwd: string,
  options?: Schema.Schema.To<
    typeof ConfigSchema
  >["parseCompilerOptions" | "examplesCompilerOptions"]
): Effect.Effect<
  never,
  Error,
  {
    readonly [x: string]: unknown
  }
> {
  if (options === undefined) {
    return Effect.succeed({})
  }
  if (typeof options === "object") {
    return Effect.succeed(options)
  }

  return Effect.tryPromise({
    try: () =>
      tsconfck.parse(NodePath.resolve(cwd, options)).then(({ tsconfig }) =>
        tsconfig.compilerOptions ?? {}
      ),
    catch: (error) => new Error(`[Config] Failed to resolve ${options}: ${String(error)}`)
  })
}
