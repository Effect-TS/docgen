/**
 * @since 1.0.0
 */
import * as Context from "@effect/data/Context"
import * as Data from "@effect/data/Data"
import { pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import * as Effect from "@effect/io/Effect"
import * as Layer from "@effect/io/Layer"
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import chalk from "chalk"
import * as NodePath from "node:path"
import * as FileSystem from "./FileSystem"
import * as Process from "./Process"

const PACKAGE_JSON_FILE_NAME = "package.json"
const CONFIG_FILE_NAME = "docgen.json"

/**
 * @category model
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
 * @category model
 * @since 1.0.0
 */
export interface ConfigError extends Data.Case {
  readonly _tag: "ConfigError"
  readonly message: string
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const ConfigError = Data.tagged<ConfigError>("ConfigError")

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
  parseCompilerOptions: Schema.record(Schema.string, Schema.unknown),
  examplesCompilerOptions: Schema.record(Schema.string, Schema.unknown)
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
): Effect.Effect<never, ConfigError | FileSystem.ReadFileError | FileSystem.ParseJsonError, A> =>
  pipe(
    fileSystem.readJsonFile(path),
    Effect.flatMap((content) =>
      pipe(
        Schema.parseEither(schema)(content),
        Effect.mapError((e) => ConfigError({ message: TreeFormatter.formatErrors(e.errors) }))
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
  ConfigError | FileSystem.ReadFileError | FileSystem.ParseJsonError,
  Option.Option<Schema.To<typeof PartialConfigSchema>>
> =>
  Effect.ifEffect(
    fileSystem.pathExists(path),
    pipe(
      Effect.logInfo(chalk.bold("Configuration file found")),
      Effect.zipRight(parseJsonFile(PartialConfigSchema, path, fileSystem)),
      Effect.map(Option.some)
    ),
    pipe(
      Effect.logInfo(chalk.bold("No configuration file detected, using default configuration")),
      Effect.as(Option.none())
    )
  )

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

    return Config.of(
      Option.match(
        maybeConfig,
        () => defaultConfig,
        (loadedConfig) => ({ ...defaultConfig, loadedConfig })
      )
    )
  })
)
