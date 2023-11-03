/**
 * @since 1.0.0
 */

import { Path } from "@effect/platform-node"
import chalk from "chalk"
import { Console, Data, Effect, Layer, Logger, LogLevel, ReadonlyArray, String } from "effect"
import ast from "ts-morph"
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
    const fileName = path.relative(path.normalize(path.join(cwd, config.docsOutDir)), file.path)

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

const transformImportDeclarations = (example: string) => {
  const project = new ast.Project()
  const sourceFile = project.createSourceFile("noop", example)

  for (const declaration of sourceFile.getImportDeclarations()) {
    declaration.replaceWithText(getAsyncImport(declaration))
  }

  return sourceFile.getFullText()
}

const getAsyncImport = (declaration: ast.ImportDeclaration) => {
  const specifier = declaration.getModuleSpecifierValue()
  const wildcard = declaration.getNamespaceImport()?.getText()
  if (wildcard !== undefined) {
    return `const ${wildcard} = await import("${specifier}")`
  }

  const names = declaration.getNamedImports().map((_) => _.getName())
  if (names.length > 0) {
    return `const { ${names.join(", ")} } = await import("${specifier}")`
  }

  return `await import("${specifier}")`
}

class Example extends Data.TaggedClass("Example")<{
  readonly name: string
  readonly body: string
}> {}

class Module extends Data.TaggedClass("Module")<{
  readonly name: string
  readonly path: ReadonlyArray<string>
  readonly examples: ReadonlyArray<Example>
}> {}

const getExamplesTestCases = (id: string) => (doc: Domain.NamedDoc): ReadonlyArray<Example> =>
  ReadonlyArray.map(doc.examples, (content, i) => {
    const transformed = transformImportDeclarations(content)
    return new Example({
      name: `${id} > ${doc.name} (${i})`,
      body: transformed
    })
  })

const getExampleTestModules = (modules: ReadonlyArray<Domain.Module>): ReadonlyArray<Module> =>
  ReadonlyArray.map(modules, (module) => {
    const moduleExamples = getExamplesTestCases("module")(module)
    const methodsExamples = ReadonlyArray.flatMap(module.classes, (c) =>
      ReadonlyArray.flatten([
        ReadonlyArray.flatMap(
          c.methods,
          getExamplesTestCases(`${c.name}-method`)
        ),
        ReadonlyArray.flatMap(
          c.staticMethods,
          getExamplesTestCases(`${c.name}-staticmethod`)
        )
      ]))

    const interfacesExamples = ReadonlyArray.flatMap(
      module.interfaces,
      getExamplesTestCases("interface")
    )

    const typeAliasesExamples = ReadonlyArray.flatMap(
      module.typeAliases,
      getExamplesTestCases("typealias")
    )

    const constantsExamples = ReadonlyArray.flatMap(
      module.constants,
      getExamplesTestCases("constant")
    )

    const functionsExamples = ReadonlyArray.flatMap(
      module.functions,
      getExamplesTestCases("function")
    )

    const cases = ReadonlyArray.flatten([
      moduleExamples,
      methodsExamples,
      interfacesExamples,
      typeAliasesExamples,
      constantsExamples,
      functionsExamples
    ])

    return new Module({
      name: module.name,
      path: module.path,
      examples: cases
    })
  }).filter((_) => _.examples.length > 0)

const printExampleTest = (example: Example) =>
  `it("${example.name}", async () => {
    ${example.body.split("\n").join("\n    ")}
  })`

const printExampleTests = (module: Module) =>
  `describe("${module.name}", () => {
  ${module.examples.map((_) => printExampleTest(_)).join("\n\n  ")}
})`

const writeExampleTestsFile = (modules: ReadonlyArray<Module>) =>
  Effect.gen(function*(_) {
    const content = `import { assert, expect, describe, it } from "vitest"

${modules.map((_) => printExampleTests(_)).join("\n\n")}
`

    const path = yield* _(Path.Path)
    const config = yield* _(Config.Config)
    const process = yield* _(Process.Process)
    const fs = yield* _(FileSystem.FileSystem)
    const cwd = yield* _(process.cwd)
    const file = path.normalize(path.join(cwd, config.examplesOutFile))
    return yield* _(fs.writeFile(file, content))
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
    path.normalize(path.join(cwd, config.docsOutDir, "index.md")),
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
    path.normalize(path.join(cwd, config.docsOutDir, "modules", "index.md")),
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
  const configPath = path.normalize(path.join(cwd, config.docsOutDir, "_config.yml"))
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
    return path.normalize(
      path.join(config.docsOutDir, "modules", `${module.path.join(path.sep)}.md`)
    )
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
    const pattern = path.normalize(path.join(config.docsOutDir, "**/*.ts.md"))
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
  yield* _(Effect.logInfo("Creating markdown files..."))
  const markdown = yield* _(getMarkdown(modules))
  yield* _(Effect.logInfo("Writing markdown files..."))
  yield* _(writeMarkdown(markdown))
  yield* _(Effect.logInfo("Creating example test files..."))
  const examples = getExampleTestModules(modules)
  yield* _(Effect.logInfo("Writing example test files..."))
  yield* _(writeExampleTestsFile(examples))
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
