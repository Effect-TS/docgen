import { pipe } from "@effect/data/Function"
import * as ReadonlyRecord from "@effect/data/ReadonlyRecord"
import * as Effect from "@effect/io/Effect"
import * as path from "node:path"
import * as FileSystem from "../src/FileSystem"

const excludeEffectPackages = (deps: Record<string, string>): Record<string, string> => {
  return ReadonlyRecord.filter(deps, (_, k) => !k.startsWith("@effect"))
}

const read = pipe(
  FileSystem.readJsonFile("package.json"),
  Effect.map((json: any) => ({
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
  }))
)

const pathTo = path.join("dist", "package.json")

const write = (pkg: object) => FileSystem.writeFile(pathTo, JSON.stringify(pkg, null, 2))

const program = pipe(
  Effect.sync(() => console.log(`copying package.json to ${pathTo}...`)),
  Effect.flatMap(() => read),
  Effect.flatMap(write)
)

Effect.runPromise(program)
