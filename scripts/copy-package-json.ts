import * as NodeContext from "@effect/platform-node/NodeContext"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as FileSystem from "@effect/platform/FileSystem"
import * as Path from "@effect/platform/Path"
import * as Effect from "effect/Effect"
import * as ReadonlyRecord from "effect/ReadonlyRecord"

const excludedPrefixes = ["@effect", "effect", "chalk", "tsconfck", "ts-morph"]

const excludeEffectPackages = (deps: Record<string, string>): Record<string, string> =>
  ReadonlyRecord.filter(deps, (_, k) => !excludedPrefixes.some((_) => k.startsWith(_)))

const program = Effect.gen(function*(_) {
  const fs = yield* _(FileSystem.FileSystem)
  const path = yield* _(Path.Path)
  yield* _(Effect.log(`[Build] Copying schema.json ...`))
  yield* _(fs.copyFile("schema.json", path.join("dist", "schema.json")))
  yield* _(Effect.log(`[Build] Copying package.json ...`))
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
  yield* _(fs.writeFileString(path.join("dist", "package.json"), JSON.stringify(pkg, null, 2)))
  yield* _(Effect.log("[Build] Build completed."))
})

program.pipe(
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
