import { Effect, ReadonlyRecord } from "effect"
import * as path from "node:path"
import * as FileSystem from "../src/FileSystem"

const excludedPrefixes = ["@effect", "effect", "chalk"]

const excludeEffectPackages = (deps: Record<string, string>): Record<string, string> =>
  ReadonlyRecord.filter(deps, (_, k) => !excludedPrefixes.some((_) => k.startsWith(_)))

const pathTo = path.join("dist", "package.json")

const program = Effect.gen(function*(_) {
  console.log(`[Build] Copying package.json to ${pathTo}...`)
  const fs = yield* _(FileSystem.FileSystem)
  const json: any = yield* _(fs.readJsonFile("package.json"))
  const pkg = {
    name: json.name,
    version: json.version,
    description: json.description,
    main: "bin.js",
    bin: "bin.js",
    engines: json.engines,
    dependencies: excludeEffectPackages(json.dependencies),
    peerDependencies: excludeEffectPackages(json.peerDependencies),
    repository: json.repository,
    author: json.author,
    license: json.license,
    bugs: json.bugs,
    homepage: json.homepage,
    tags: json.tags,
    keywords: json.keywords
  }
  yield* _(fs.writeFile(pathTo, JSON.stringify(pkg, null, 2)))
  console.log("[Build] Build completed.")
}).pipe(
  Effect.provide(FileSystem.FileSystemLive)
)

Effect.runPromise(program).catch(console.error)
