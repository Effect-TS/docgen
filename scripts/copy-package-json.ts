import * as PlatformFileSystem from "@effect/platform-node/FileSystem"
import { Console, Effect, ReadonlyRecord } from "effect"
import * as path from "node:path"
import * as FileSystem from "../src/FileSystem"

const excludedPrefixes = ["@effect", "effect", "chalk"]

const excludeEffectPackages = (
  deps: Record<string, string>
): Record<string, string> => {
  return ReadonlyRecord.filter(
    deps,
    (_, k) => !excludedPrefixes.some((_) => k.startsWith(_))
  )
}

const read = FileSystem.FileSystem.pipe(
  Effect.flatMap((fileSystem) => fileSystem.readJsonFile("package.json")),
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

const write = (pkg: object) =>
  Effect.flatMap(
    FileSystem.FileSystem,
    (fileSystem) => fileSystem.writeFile(pathTo, JSON.stringify(pkg, null, 2))
  )

const program = Console.log(`copying package.json to ${pathTo}...`).pipe(
  Effect.zipRight(read),
  Effect.flatMap(write),
  Effect.provide(FileSystem.FileSystemLive),
  Effect.provide(PlatformFileSystem.layer)
)

Effect.runPromise(program)
