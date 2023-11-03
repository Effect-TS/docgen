/**
 * @since 1.0.0
 */
import { Path } from "@effect/platform-node"
import { Schema, TreeFormatter } from "@effect/schema"
import chalk from "chalk"
import { Context, Effect, Layer, Option } from "effect"
import * as FileSystem from "./FileSystem.js"
import * as Process from "./Process.js"

const PACKAGE_JSON_FILE_NAME = "package.json"
const CONFIG_FILE_NAME = "docgen.json"

/**
 * @category service
 * @since 1.0.0
 */
export const ConfigSchema = Schema.struct({
  "$schema": Schema.optional(Schema.string),
  projectHomepage: Schema.optional(Schema.string, {
    description:
      "Will link to the project homepage from the Auxiliary Links of the generated documentation."
  }),
  docsOutDir: Schema.optional(Schema.string, {
    description: "The directory to which docgen will generate its output markdown documents."
  }),
  examplesOutFile: Schema.optional(Schema.string, {
    description: "The file to which docgen will generate its output examples tests."
  }),
  theme: Schema.optional(Schema.string, {
    description:
      "The theme that docgen will specify should be used for GitHub Docs in the generated _config.yml file."
  }),
  enableSearch: Schema.optional(Schema.boolean, {
    description:
      "Whether or search should be enabled for GitHub Docs in the generated _config.yml file."
  }),
  enforceDescriptions: Schema.optional(Schema.boolean, {
    description: "Whether or not descriptions for each module export should be required."
  }),
  exclude: Schema.optional(Schema.array(Schema.string), {
    description:
      "An array of glob strings specifying files that should be excluded from the documentation."
  }),
  enforceExamples: Schema.optional(Schema.boolean, {
    description:
      "Whether or not @example tags for each module export should be required. (Note: examples will not be enforced in module documentation)"
  }),
  enforceVersion: Schema.optional(Schema.boolean, {
    description: "Whether or not @since tags for each module export should be required."
  }),
  tsConfig: Schema.optional(Schema.string, {
    description: "The path to the source tsconfig.json file for the project."
  })
})

/**
 * @category service
 * @since 1.0.0
 */
export interface Config {
  readonly projectName: string
  readonly projectHomepage: string
  readonly docsOutDir: string
  readonly examplesOutFile: string
  readonly theme: string
  readonly enableSearch: boolean
  readonly enforceDescriptions: boolean
  readonly enforceExamples: boolean
  readonly enforceVersion: boolean
  readonly exclude: ReadonlyArray<string>
  readonly tsConfig: string
}

/**
 * @category service
 * @since 1.0.0
 */
export const Config = Context.Tag<Config>()

const PackageJsonSchema = Schema.struct({
  name: Schema.string,
  homepage: Schema.string
})

const validateJsonFile = <I, A>(
  schema: Schema.Schema<I, A>,
  path: string
): Effect.Effect<FileSystem.FileSystem, Error, A> =>
  Effect.gen(function*(_) {
    const content = yield* _(FileSystem.readJsonFile(path))
    return yield* _(
      Schema.parse(schema)(content),
      Effect.mapError((e) =>
        new Error(`[Config] Invalid config:\n${TreeFormatter.formatErrors(e.errors)}`)
      )
    )
  })

/** @internal */
export const getDefaultConfig = (name: string, homepage: string): Config => ({
  projectName: name,
  projectHomepage: homepage,
  docsOutDir: "docs",
  examplesOutFile: "test/Examples.ts",
  theme: "mikearnaldi/just-the-docs",
  enableSearch: true,
  enforceDescriptions: false,
  enforceExamples: false,
  enforceVersion: true,
  exclude: [],
  tsConfig: "tsconfig.build.json"
})

const loadConfig = (
  path: string
): Effect.Effect<
  FileSystem.FileSystem,
  Error,
  Option.Option<Schema.Schema.To<typeof ConfigSchema>>
> =>
  Effect.gen(function*(_) {
    const fs = yield* _(FileSystem.FileSystem)
    const exists = yield* _(fs.exists(path))
    if (exists) {
      const config = yield* _(validateJsonFile(ConfigSchema, path))
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
    const path = yield* _(Path.Path)
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)

    // Read and parse the package.json
    const packageJsonPath = path.join(cwd, PACKAGE_JSON_FILE_NAME)
    const packageJson = yield* _(validateJsonFile(PackageJsonSchema, packageJsonPath))

    // Read and resolve the configuration
    const defaultConfig = getDefaultConfig(packageJson.name, packageJson.homepage)
    const configPath = path.join(cwd, CONFIG_FILE_NAME)
    const maybeConfig = yield* _(loadConfig(configPath))

    if (Option.isNone(maybeConfig)) {
      yield* _(
        Effect.logInfo(chalk.bold("No configuration file detected, using default configuration"))
      )
      return Config.of(defaultConfig)
    }

    yield* _(Effect.logInfo(chalk.bold("Configuration file found")))

    return Config.of(
      {
        ...defaultConfig,
        ...maybeConfig.value
      }
    )
  })
)
