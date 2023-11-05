import { ConfigSchema } from "@effect/docgen/Config"
import * as FileSystem from "@effect/docgen/FileSystem"
import { JSONSchema } from "@effect/schema"
import { Effect } from "effect"

const program = Effect.gen(function*(_) {
  const fs = yield* _(FileSystem.FileSystem)
  yield* _(Effect.log("Writing config schema"))
  yield* _(fs.writeFile("schema.json", JSON.stringify(JSONSchema.to(ConfigSchema), null, 2)))
  yield* _(Effect.log("Wrote schema to ./schema.json"))
})

const runnable = program.pipe(
  Effect.provide(FileSystem.FileSystemLive)
)

Effect.runPromise(runnable.pipe(Effect.tapErrorCause((_) => Effect.logError(_))))
