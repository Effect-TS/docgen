#!/usr/bin/env node

/**
 * @since 1.0.0
 */

import * as Command from "@effect/cli/Command"
import * as HelpDoc from "@effect/cli/HelpDoc"
import * as Options from "@effect/cli/Options"
import * as ValidationError from "@effect/cli/ValidationError"
import * as NodeContext from "@effect/platform-node/NodeContext"
import * as Runtime from "@effect/platform-node/Runtime"
import * as Schema from "@effect/schema/Schema"
import * as TreeFormatter from "@effect/schema/TreeFormatter"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Either from "effect/Either"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as LogLevel from "effect/LogLevel"
import * as Configuration from "./Configuration.js"
import * as Core from "./Core.js"
import { SimpleLogger } from "./Logger.js"
import * as Process from "./Process.js"

const projectHomepage = Options.text("homepage").pipe(
  Options.withFallbackConfig(Config.string("homepage")),
  Options.withDescription(
    "The link to the project homepage (will be shown in the Auxiliary Links " +
      "of the generated documentation)"
  ),
  Options.optional
)

const srcDir = Options.directory("src", { exists: "yes" }).pipe(
  Options.withFallbackConfig(Config.string("src").pipe(Config.withDefault("src"))),
  Options.withDescription(
    "The directory in which docgen will search for TypeScript files to parse"
  )
)

const outDir = Options.directory("out").pipe(
  Options.withFallbackConfig(Config.string("out").pipe(Config.withDefault("docs"))),
  Options.withDescription(
    "The directory to which docgen will generate its output markdown documents"
  )
)

const theme = Options.directory("theme").pipe(
  Options.withFallbackConfig(
    Config.string("theme").pipe(
      Config.withDefault("mikearnaldi/just-the-docs")
    )
  ),
  Options.withDescription(
    "The Jekyll theme that should be used for the generated documentation"
  )
)

const enableSearch = Options.boolean("disable-search").pipe(
  Options.withFallbackConfig(Config.boolean("disable-search")),
  Options.withDescription(
    "Whether or not search should be enabled in the generated documentation"
  )
)

const enforceDescriptions = Options.boolean("enforce-descriptions", {
  negationNames: ["no-enforce-descriptions"]
}).pipe(
  Options.withFallbackConfig(Config.boolean("enforce-descriptions")),
  Options.withDescription(
    "Whether or not a description for each module export should be required"
  )
)

const enforceExamples = Options.boolean("enforce-examples", {
  negationNames: ["no-enforce-examples"]
}).pipe(
  Options.withFallbackConfig(Config.boolean("enforce-examples")),
  Options.withDescription(
    "Whether or not @example tags for each module export should be required " +
      "(Note: examples will not be enforced in module documentation)"
  )
)

const enforceVersion = Options.boolean("no-enforce-version", {
  ifPresent: false,
  negationNames: ["enforce-version"]
}).pipe(
  Options.withFallbackConfig(Config.boolean("enforce-version")),
  Options.withDescription(
    "Whether or not @since tags for each module export should be required"
  )
)

const runExamples = Options.boolean("no-run-examples", {
  ifPresent: false,
  negationNames: ["run-examples"]
}).pipe(
  Options.withDescription(
    "Whether or not to execute examples discovered in the TypeScript source files"
  )
)

const exclude = Options.text("exclude").pipe(
  Options.repeated,
  Options.withFallbackConfig(Config.array(Config.string("exclude")).pipe(Config.withDefault([]))),
  Options.withDescription(
    "An array of glob patterns specifying files that should be excluded from " +
      "the generated documentation"
  )
)

const compilerOptionsSchema = Schema.record(Schema.string, Schema.unknown)

const parseCompilerOptions = Options.file("parse-tsconfig-file", { exists: "yes" }).pipe(
  Options.withDescription("The TypeScript TSConfig file to use for parsing source files"),
  Options.orElse(
    Options.text("parse-compiler-options").pipe(
      Options.withDescription("The TypeScript compiler options to use for parsing source files"),
      Options.mapOrFail((options) =>
        Schema.parseEither(compilerOptionsSchema)(options).pipe(
          Either.mapLeft(({ errors }) => {
            const error = HelpDoc.p(
              `Invalid TypeScript compiler options:\n${TreeFormatter.formatErrors(errors)}`
            )
            return ValidationError.invalidValue(error)
          })
        )
      )
    )
  ),
  Options.optional
)

const examplesCompilerOptions = Options.file("examples-tsconfig-file", { exists: "yes" }).pipe(
  Options.withDescription("The TypeScript TSConfig file to use for examples"),
  Options.orElse(
    Options.text("examples-compiler-options").pipe(
      Options.withDescription("The TypeScript compiler options to use for examples"),
      Options.mapOrFail((options) =>
        Schema.parseEither(compilerOptionsSchema)(options).pipe(
          Either.mapLeft(({ errors }) => {
            const error = HelpDoc.p(
              `Invalid TypeScript compiler options:\n${TreeFormatter.formatErrors(errors)}`
            )
            return ValidationError.invalidValue(error)
          })
        )
      )
    )
  ),
  Options.optional
)

const options = {
  projectHomepage,
  srcDir,
  outDir,
  theme,
  enableSearch,
  enforceDescriptions,
  enforceExamples,
  enforceVersion,
  runExamples,
  exclude,
  parseCompilerOptions,
  examplesCompilerOptions
}

const cli = Command.make("docgen", options).pipe(
  Command.withHandler(() => Core.program),
  Command.provideEffect(Configuration.Configuration, (args) => Configuration.load(args)),
  Command.run({
    name: "docgen",
    version: "v1.0.0"
  })
)

const MainLive = Configuration.configProviderLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(
    Logger.replace(Logger.defaultLogger, SimpleLogger),
    Logger.minimumLogLevel(LogLevel.Info),
    Process.ProcessLive,
    NodeContext.layer
  ))
)

Effect.sync(() => process.argv.slice(2)).pipe(
  Effect.flatMap((args) => cli(args)),
  Effect.provide(MainLive),
  Runtime.runMain
)
