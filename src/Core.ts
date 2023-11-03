/**
 * @since 1.0.0
 */

import { Path } from "@effect/platform-node"
import chalk from "chalk"
import { Console, Effect, Layer, Logger, LogLevel, ReadonlyArray, String } from "effect"
import * as ChildProcess from "./CommandExecutor.js"
import * as Config from "./Config.js"
import type * as Domain from "./Domain.js"
import * as FileSystem from "./FileSystem.js"
import { SimpleLogger } from "./Logger.js"
import { printModule } from "./Markdown.js"
import * as Parser from "./Parser.js"
import * as Process from "./Process.js"

/**
 * Writes a file to the `config.outDir` directory, taking into account the configuration and existing files.
 */
const writeFileToOutDir = (file: FileSystem.File) =>
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)
    const config = yield* _(Config.Config)
    const fs = yield* _(FileSystem.FileSystem)
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
    const fileName = path.relative(path.normalize(path.join(cwd, config.outDir)), file.path)

    const exists = yield* _(fs.exists(file.path))
    if (exists) {
      if (file.isOverwriteable) {
        yield* _(Effect.logDebug(`Overwriting file ${chalk.black(fileName)}...`))
        yield* _(fs.writeFile(file.path, file.content))
      } else {
        yield* _(Effect.logDebug(
          `File ${chalk.black(fileName)} already exists, skipping creation.`
        ))
      }
    } else {
      yield* _(fs.writeFile(file.path, file.content))
    }
  })

const writeFilesToOutDir = (
  files: ReadonlyArray<FileSystem.File>
) => Effect.forEach(files, writeFileToOutDir, { discard: true })

const parseModules = () =>
  Parser.parseProject().pipe(
    Effect.mapError((errors) =>
      new Error(
        `The following error(s) occurred while parsing the TypeScript source files:\n${
          errors.map((errors) => errors.join("\n")).join("\n")
        }`
      )
    )
  )

/**
 * Runs the example files for the given modules, type-checking them before execution.
 */
const typeCheckAndRunExamples = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.gen(function*(_) {
    const files = yield* _(getExampleFiles(modules))
    if (files.length > 0) {
      yield* _(Effect.logInfo(`${files.length} example(s) found`))
      yield* _(writeExamplesToOutDir(files))
      yield* _(createExamplesTsConfigJson)
      yield* _(typeCheckExamples)
      yield* _(runExamples)
    } else {
      yield* _(Effect.logInfo("No examples found."))
    }
    yield* _(cleanupExamples)
  })

/**
 * Generates example files for the given modules.
 */
const getExampleFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const path = yield* _(Path.Path)

    return ReadonlyArray.flatMap(modules, (module) => {
      const prefix = module.path.join("-")

      const getFiles =
        (exampleId: string) => (doc: Domain.NamedDoc): ReadonlyArray<FileSystem.File> =>
          ReadonlyArray.map(doc.examples, (content, i) => {
            const name = `${prefix}-${exampleId}-${doc.name}-${i}.ts`
            const file = path.normalize(path.join(config.outDir, "examples", name))
            return FileSystem.createFile(file, `${addAssertImport(content)}\n`, true)
          })

      const moduleExamples = getFiles("module")(module)
      const methodsExamples = ReadonlyArray.flatMap(module.classes, (c) =>
        ReadonlyArray.flatten([
          ReadonlyArray.flatMap(
            c.methods,
            getFiles(`${c.name}-method`)
          ),
          ReadonlyArray.flatMap(
            c.staticMethods,
            getFiles(`${c.name}-staticmethod`)
          )
        ]))

      const interfacesExamples = ReadonlyArray.flatMap(
        module.interfaces,
        getFiles("interface")
      )

      const typeAliasesExamples = ReadonlyArray.flatMap(
        module.typeAliases,
        getFiles("typealias")
      )

      const constantsExamples = ReadonlyArray.flatMap(
        module.constants,
        getFiles("constant")
      )

      const functionsExamples = ReadonlyArray.flatMap(
        module.functions,
        getFiles("function")
      )

      return ReadonlyArray.flatten([
        moduleExamples,
        methodsExamples,
        interfacesExamples,
        typeAliasesExamples,
        constantsExamples,
        functionsExamples
      ])
    })
  })

/**
 * Adds an import statement for the `assert` module to the beginning of the given code, if it doesn't already exist.
 */
const addAssertImport = (code: string): string =>
  code.indexOf("assert.") !== -1
    ? `import * as assert from "assert"\n${code}`
    : code

/**
 * Generates an entry point file for the given examples.
 */
const getExamplesEntryPoint = (examples: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)
    const config = yield* _(Config.Config)
    const content = examples.map((example) => `import "./${path.basename(example.path, ".ts")}.js"`)
      .join("\n")
    return FileSystem.createFile(
      path.normalize(path.join(config.outDir, "examples", "index.ts")),
      `${content}\n`,
      true // make the file overwritable
    )
  })

/**
 * Removes the "examples" directory from the output directory specified in the configuration.
 */
const cleanupExamples = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const fs = yield* _(FileSystem.FileSystem)
  const config = yield* _(Config.Config)
  yield* _(fs.removeFile(path.normalize(path.join(config.outDir, "examples"))))
})

/**
 * Runs `tsc` on the examples.
 */
const typeCheckExamples = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const executor = yield* _(ChildProcess.CommandExecutor)
  const cwd = yield* _(process.cwd)
  const platform = yield* _(process.platform)
  const command = platform === "win32" ? "tsc.cmd" : "tsc"
  const arg = path.normalize(path.join(cwd, config.outDir, "examples", "tsconfig.json"))
  yield* _(Effect.logDebug("Type checking examples..."))
  yield* _(executor.spawn(command, "-b", arg))
})

/**
 * Runs `tsx` on the examples.
 */
const runExamples = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const executor = yield* _(ChildProcess.CommandExecutor)
  const cwd = yield* _(process.cwd)
  const platform = yield* _(process.platform)
  const command = platform === "win32" ? "tsx.cmd" : "tsx"
  const arg = path.normalize(path.join(cwd, config.outDir, "examples", "index.ts"))
  yield* _(Effect.logDebug("Running examples..."))
  yield* _(executor.spawn(command, arg))
})

const writeExamplesToOutDir = (examples: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    yield* _(Effect.logDebug("Writing examples..."))
    const entryPoint = yield* _(getExamplesEntryPoint(examples))
    const files = [entryPoint, ...examples]
    yield* _(writeFilesToOutDir(files))
  })

const createExamplesTsConfigJson = Effect.gen(function*(_) {
  yield* _(Effect.logDebug("Writing examples tsconfig..."))
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  const examplesDir = path.join(cwd, config.outDir, "examples")
  const examplesConfig = path.normalize(path.join(examplesDir, "tsconfig.json"))
  const baseConfig = path.normalize(path.relative(examplesDir, config.baseTsConfig))
  const sourceConfig = path.normalize(path.relative(examplesDir, config.sourceTsConfig))
  const configJson = JSON.stringify({
    extends: baseConfig,
    include: ["."],
    references: [{ path: sourceConfig }],
    compilerOptions: { noEmit: true }
  })
  yield* _(writeFileToOutDir(FileSystem.createFile(examplesConfig, configJson, true)))
})

const getMarkdown = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.gen(function*(_) {
    const homepage = yield* _(getMarkdownHomepage)
    const index = yield* _(getMarkdownIndex)
    const yml = yield* _(getMarkdownConfigYML)
    const moduleFiles = yield* _(getModuleMarkdownFiles(modules))
    return [homepage, index, yml, ...moduleFiles]
  })

const getMarkdownHomepage = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  return FileSystem.createFile(
    path.normalize(path.join(cwd, config.outDir, "index.md")),
    String.stripMargin(
      `|---
       |title: Home
       |nav_order: 1
       |---
       |`
    ),
    false
  )
})

const getMarkdownIndex = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  return FileSystem.createFile(
    path.normalize(path.join(cwd, config.outDir, "modules", "index.md")),
    String.stripMargin(
      `|---
     |title: Modules
     |has_children: true
     |permalink: /docs/modules
     |nav_order: 2
     |---
     |`
    ),
    false
  )
})

const resolveConfigYML = (content: string) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    return content
      .replace(/^remote_theme:.*$/m, `remote_theme: ${config.theme}`)
      .replace(
        /^search_enabled:.*$/m,
        `search_enabled: ${config.enableSearch}`
      ).replace(
        /^ {2}'\S* on GitHub':\n {4}- '.*'/m,
        `  '${config.projectName} on GitHub':\n    - '${config.projectHomepage}'`
      )
  })

const getHomepageNavigationHeader = (config: Config.Config): string => {
  const isGitHub = config.projectHomepage.toLowerCase().includes("github")
  return isGitHub ? config.projectName + " on GitHub" : "Homepage"
}

const getMarkdownConfigYML = Effect.gen(function*(_) {
  const path = yield* _(Path.Path)
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const fs = yield* _(FileSystem.FileSystem)
  const cwd = yield* _(process.cwd)
  const configPath = path.normalize(path.join(cwd, config.outDir, "_config.yml"))
  const exists = yield* _(fs.exists(configPath))
  if (exists) {
    const content = yield* _(fs.readFile(configPath))
    const resolved = yield* _(resolveConfigYML(content))
    return FileSystem.createFile(configPath, resolved, true)
  } else {
    return FileSystem.createFile(
      configPath,
      String.stripMargin(
        `|remote_theme: ${config.theme}
         |
         |# Enable or disable the site search
         |search_enabled: ${config.enableSearch}
         |
         |# Aux links for the upper right navigation
         |aux_links:
         |'${getHomepageNavigationHeader(config)}':
         |  - '${config.projectHomepage}'`
      ),
      false
    )
  }
})

const getModuleMarkdownOutputPath = (module: Domain.Module) =>
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)
    const config = yield* _(Config.Config)
    return path.normalize(path.join(config.outDir, "modules", `${module.path.join(path.sep)}.md`))
  })

const getModuleMarkdownFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.forEach(modules, (module, order) =>
    Effect.gen(function*(_) {
      const outputPath = yield* _(getModuleMarkdownOutputPath(module))
      const content = yield* _(printModule(module, order + 1))
      return FileSystem.createFile(outputPath, content, true)
    }))

const writeMarkdown = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const path = yield* _(Path.Path)
    const config = yield* _(Config.Config)
    const fileSystem = yield* _(FileSystem.FileSystem)
    const pattern = path.normalize(path.join(config.outDir, "**/*.ts.md"))
    yield* _(Effect.logDebug(`Deleting ${chalk.black(pattern)}...`))
    const paths = yield* _(fileSystem.glob(pattern))
    yield* _(
      Effect.forEach(paths, (path) => fileSystem.removeFile(path), { concurrency: "unbounded" })
    )
    return yield* _(writeFilesToOutDir(files))
  })

const program = Effect.gen(function*(_) {
  yield* _(Effect.logInfo("Parsing modules..."))
  const modules = yield* _(parseModules())
  yield* _(Effect.logInfo("Typechecking examples..."))
  yield* _(typeCheckAndRunExamples(modules))
  yield* _(Effect.logInfo("Creating markdown files..."))
  const outputFiles = yield* _(getMarkdown(modules))
  yield* _(Effect.logInfo("Writing markdown files..."))
  yield* _(writeMarkdown(outputFiles))
  yield* _(Effect.logInfo(chalk.bold.green("Docs generation succeeded!")))
}).pipe(Logger.withMinimumLogLevel(LogLevel.Info))

const MainLayer = Layer.mergeAll(
  Logger.replace(Logger.defaultLogger, SimpleLogger),
  ChildProcess.CommandExecutorLive,
  FileSystem.FileSystemLive,
  Process.ProcessLive,
  Path.layer
).pipe(
  Layer.provideMerge(Config.ConfigLive)
)

const runnable = program.pipe(Effect.provide(MainLayer))

/**
 * @category main
 * @since 1.0.0
 */
export const main: Effect.Effect<never, never, void> = runnable.pipe(
  Effect.catchAll((error) => Console.error(chalk.bold.red("Error:"), error.message))
)
