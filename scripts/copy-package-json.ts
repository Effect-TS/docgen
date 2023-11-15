import * as FileSystem from "@effect/platform-node/FileSystem"
import { Effect, ReadonlyRecord } from "effect"
import * as path from "node:path"

const excludedPrefixes = ["@effect", "effect", "chalk", "tsconfck", "ts-morph"]

const excludeEffectPackages = (deps: Record<string, string>): Record<string, string> =>
  ReadonlyRecord.filter(deps, (_, k) => !excludedPrefixes.some((_) => k.startsWith(_)))

const pathTo = path.join("dist", "package.json")

const program = Effect.gen(function*(_) {
  console.log(`[Build] Copying package.json to ${pathTo}...`)
  const fs = yield* _(FileSystem.FileSystem)
  const json: any = yield* _(fs.readFileString("package.json"), Effect.map(JSON.parse))
  const pkg = {
    name: json.name,
    version: json.version,
    type: json.type,
    description: json.description,
    main: "bin.cjs",
    bin: "bin.cjs",
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
  yield* _(fs.writeFileString(pathTo, JSON.stringify(pkg, null, 2)))
  console.log("[Build] Build completed.")
}).pipe(
  Effect.provide(FileSystem.layer)
)

Effect.runPromise(program).catch(console.error)
