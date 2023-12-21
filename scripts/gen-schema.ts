import { ConfigurationSchema } from "@effect/docgen/Configuration"
import * as FileSystem from "@effect/platform-node/FileSystem"
import * as Runtime from "@effect/platform-node/Runtime"
import { JSONSchema } from "@effect/schema"
import { Effect } from "effect"

const jsonSchema = JSON.stringify(JSONSchema.to(ConfigurationSchema), null, 2)

const program = Effect.gen(function*(_) {
  const fs = yield* _(FileSystem.FileSystem)
  yield* _(Effect.log("Writing config schema"))
  yield* _(fs.writeFileString("schema.json", jsonSchema))
  yield* _(Effect.log("Wrote schema to ./schema.json"))
})

program.pipe(
  Effect.provide(FileSystem.layer),
  Runtime.runMain
)
