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
 * Reads all TypeScript files in the source directory and returns an array of file objects.
 * Each file object contains the file path and its content.
 */
const readSourceFiles = Effect.gen(function*(_) {
  const config = yield* _(Config.Config)
  const fs = yield* _(FileSystem.FileSystem)
  const path = yield* _(Path.Path, Effect.provide(Path.layerPosix))
  const paths = yield* _(
    fs.glob(path.normalize(path.join(config.srcDir, "**", "*.ts")), config.exclude)
  )
  yield* _(Effect.logInfo(chalk.bold(`${paths.length} module(s) found`)))
  return yield* _(Effect.forEach(paths, (path) =>
    Effect.map(
      fs.readFile(path),
      (content) => FileSystem.createFile(path, content, false)
    ), { concurrency: "inherit" }))
})

/**
 * Writes a file to the `config.outDir` directory, taking into account the configuration and existing files.
 */
const writeFileToOutDir = (file: FileSystem.File) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const fs = yield* _(FileSystem.FileSystem)
    const path = yield* _(Path.Path)
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
    const fileName = path.relative(path.join(cwd, config.outDir), file.path)

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

const parseModules = (files: ReadonlyArray<FileSystem.File>) =>
  Parser.parseFiles(files).pipe(
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
    yield* _(cleanupExamples)
    const files = yield* _(getExampleFiles(modules))
    const examples = yield* _(handleImports(files))
    const len = examples.length
    if (len > 0) {
      yield* _(Effect.logInfo(`${len} example(s) found`))
      yield* _(writeExamplesToOutDir(examples))
      yield* _(createExamplesTsConfigJson)
      yield* _(runTscOnExamples)
      yield* _(runTsxOnExamples)
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
          ReadonlyArray.map(
            doc.examples,
            (content, i) =>
              FileSystem.createFile(
                path.join(
                  config.outDir,
                  "examples",
                  `${prefix}-${exampleId}-${doc.name}-${i}.ts`
                ),
                `${content}\n`,
                true // make the file overwritable
              )
          )

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
    ? `import * as assert from 'assert'\n${code}`
    : code

/**
 * Replaces the project name in the given source code imports with the configured project name.
 */
const replaceProjectName = (source: string) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const importRegex = (projectName: string) =>
      new RegExp(
        `from (?<quote>['"])${projectName}(?:/lib)?(?:/(?<path>.*))?\\k<quote>`,
        "g"
      )

    const out = source.replace(importRegex(config.projectName), (...args) => {
      const groups: { path?: string } = args[args.length - 1]
      return `from '../../src${groups.path ? `/${groups.path}` : ""}'`
    })

    return out
  })

const handleImports = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.forEach(files, (file) =>
    Effect.gen(function*(_) {
      const source = yield* _(replaceProjectName(file.content))
      const content = addAssertImport(source)
      return FileSystem.createFile(file.path, content, file.isOverwriteable)
    }))

/**
 * Generates an entry point file for the given examples.
 */
const getExamplesEntryPoint = (examples: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const path = yield* _(Path.Path)
    const content = examples.map((example) => `import './${path.basename(example.path, ".ts")}'`)
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
  const fs = yield* _(FileSystem.FileSystem)
  const config = yield* _(Config.Config)
  const path = yield* _(Path.Path)
  yield* _(fs.removeFile(path.join(config.outDir, "examples")))
})

/**
 * Runs tsc on the examples directory.
 */
const runTscOnExamples = Effect.gen(function*(_) {
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const executor = yield* _(ChildProcess.CommandExecutor)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  const platform = yield* _(process.platform)

  const tsconfig = path.normalize(path.join(cwd, config.outDir, "examples", "tsconfig.json"))
  const command = platform === "win32" ? "tsc.cmd" : "tsc"
  yield* _(Effect.logDebug("Running tsc on examples..."))
  yield* _(executor.spawn(command, "--noEmit", "--project", tsconfig))
})

/**
 * Runs tsc on the examples directory.
 */
const runTsxOnExamples = Effect.gen(function*(_) {
  const config = yield* _(Config.Config)
  const path = yield* _(Path.Path)
  const process = yield* _(Process.Process)
  const executor = yield* _(ChildProcess.CommandExecutor)
  const cwd = yield* _(process.cwd)
  const platform = yield* _(process.platform)

  const examples = path.normalize(path.join(cwd, config.outDir, "examples"))
  const tsconfig = path.join(examples, "tsconfig.json")
  const index = path.join(examples, "index.ts")
  const command = platform === "win32" ? "tsx.cmd" : "tsx"
  yield* _(Effect.logDebug("Running tsx on examples..."))
  yield* _(executor.spawn(command, "--tsconfig", tsconfig, index))
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
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  yield* _(writeFileToOutDir(
    FileSystem.createFile(
      path.join(cwd, config.outDir, "examples", "tsconfig.json"),
      JSON.stringify({ compilerOptions: config.examplesCompilerOptions }, null, 2),
      true // make the file overwritable
    )
  ))
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
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  return FileSystem.createFile(
    path.join(cwd, config.outDir, "index.md"),
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
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  return FileSystem.createFile(
    path.join(cwd, config.outDir, "modules", "index.md"),
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
  const config = yield* _(Config.Config)
  const process = yield* _(Process.Process)
  const fs = yield* _(FileSystem.FileSystem)
  const cwd = yield* _(process.cwd)
  const path = yield* _(Path.Path)
  const configPath = path.join(cwd, config.outDir, "_config.yml")
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
  Effect.map(Effect.all([Config.Config, Path.Path]), ([config, path]) =>
    path.normalize(path.join(
      config.outDir,
      "modules",
      `${module.path.slice(1).join(path.sep)}.md`
    )))

const getModuleMarkdownFiles = (modules: ReadonlyArray<Domain.Module>) =>
  Effect.forEach(modules, (module, order) =>
    Effect.gen(function*(_) {
      const outputPath = yield* _(getModuleMarkdownOutputPath(module))
      const content = yield* _(printModule(module, order + 1))
      return FileSystem.createFile(outputPath, content, true)
    }))

const writeMarkdown = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const path = yield* _(Path.Path, Effect.provide(Path.layerPosix))
    const fileSystem = yield* _(FileSystem.FileSystem)
    const pattern = path.normalize(path.join(config.outDir, "**/*.ts.md"))
    yield* _(Effect.logDebug(`Deleting ${chalk.black(pattern)}...`))
    const paths = yield* _(fileSystem.glob(pattern))
    yield* _(
      Effect.forEach(paths, (path) => fileSystem.removeFile(path), { concurrency: "unbounded" })
    )
    return yield* _(writeFilesToOutDir(files))
  })

const NO_EXAMPLES_OPTION = "--no-examples"

const program = Effect.gen(function*(_) {
  yield* _(Effect.logInfo("Reading modules..."))
  const sourceFiles = yield* _(readSourceFiles)
  yield* _(Effect.logInfo("Parsing modules..."))
  const modules = yield* _(parseModules(sourceFiles))
  const process = yield* _(Process.Process)
  const argv = yield* _(process.argv)
  if (!argv.slice(2).some((arg) => arg === NO_EXAMPLES_OPTION)) {
    yield* _(Effect.logInfo("Typechecking examples..."))
    yield* _(typeCheckAndRunExamples(modules))
  }
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
  Path.layer,
  Process.ProcessLive
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
