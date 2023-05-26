import { pipe } from "@effect/data/Function"
import * as ReadonlyRecord from "@effect/data/ReadonlyRecord"
import * as Effect from "@effect/io/Effect"
import * as path from "node:path"
import * as FileSystem from "../src/FileSystem"

const excludeEffectPackages = (deps: Record<string, string>): Record<string, string> => {
  return ReadonlyRecord.filter(deps, (_, k) => !k.startsWith("@effect"))
}

const patch = pipe(
  FileSystem.readJsonFile("package.json"),
  Effect.map((json: any) => ({
    version: json.version,
    description: json.description,
    dependencies: excludeEffectPackages(json.dependencies),
    peerDependencies: excludeEffectPackages(json.peerDependencies),
    tags: json.tags,
    keywords: json.keywords
  }))
)

const pathTo = path.join("dist", "package.json")

const pkg = pipe(
  FileSystem.readJsonFile(pathTo),
  Effect.map((json) => json as any)
)

const applyPatch = pipe(
  Effect.all(patch, pkg),
  Effect.map(([patch, pkg]) => {
    return ({ ...patch, ...pkg })
  })
)

const program = pipe(
  applyPatch,
  Effect.flatMap((pkg) => {
    return FileSystem.writeFile(pathTo, JSON.stringify(pkg, null, 2))
  })
)

Effect.runPromise(program)
