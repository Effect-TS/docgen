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

const parseJsonFile = <I, A>(
  schema: Schema.Schema<I, A>,
  path: string,
  fileSystem: FileSystem.FileSystem
): Effect.Effect<never, Error, A> =>
  fileSystem.readJsonFile(path).pipe(
    Effect.flatMap((content) =>
      Schema.parse(schema)(content).pipe(
        Effect.mapError((e) =>
          new Error(`[Config] Invalid config:\n${TreeFormatter.formatErrors(e.errors)}`)
        )
      )
    )
  )

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
  path: string,
  fileSystem: FileSystem.FileSystem
): Effect.Effect<
  never,
  Error,
  Option.Option<Schema.Schema.To<typeof PartialConfigSchema>>
> =>
  Effect.if(fileSystem.pathExists(path), {
    onTrue: Effect.logInfo(chalk.bold("Configuration file found")).pipe(
      Effect.zipRight(parseJsonFile(PartialConfigSchema, path, fileSystem)),
      Effect.asSome
    ),
    onFalse: Effect.as(
      Effect.logInfo(
        chalk.bold("No configuration file detected, using default configuration")
      ),
      Option.none()
    )
  })

/**
 * @category service
 * @since 1.0.0
 */
export const ConfigLive = Layer.effect(
  Config,
  Effect.gen(function*($) {
    // Extract the requisite services
    const process = yield* $(Process.Process)
    const fileSystem = yield* $(FileSystem.FileSystem)
    const cwd = yield* $(process.cwd)

    // Read and parse the package.json
    const packageJsonPath = NodePath.join(cwd, PACKAGE_JSON_FILE_NAME)
    const packageJson = yield* $(parseJsonFile(PackageJsonSchema, packageJsonPath, fileSystem))

    // Read and resolve the configuration
    const defaultConfig = getDefaultConfig(packageJson.name, packageJson.homepage)
    const configPath = NodePath.join(cwd, CONFIG_FILE_NAME)
    const maybeConfig = yield* $(loadConfig(configPath, fileSystem))

    if (Option.isNone(maybeConfig)) {
      return Config.of(defaultConfig)
    }

    // Allow the user to provide a path to a tsconfig.json file to resolve the compiler options
    const examplesCompilerOptions = yield* $(
      resolveCompilerOptions(cwd, maybeConfig.value.examplesCompilerOptions)
    )
    const parseCompilerOptions = yield* $(
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
  if (options === undefined) return Effect.succeed({})
  if (typeof options === "object") return Effect.succeed(options)

  return Effect.tryPromise({
    try: () =>
      tsconfck.parse(NodePath.resolve(cwd, options)).then(({ tsconfig }) =>
        tsconfig.compilerOptions ?? {}
      ),
    catch: (error) => new Error(`[Config] Failed to resolve ${options}: ${String(error)}`)
  })
}
