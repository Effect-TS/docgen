/**
 * @category service
 * @since 1.0.0
 */
import { Schema } from "@effect/schema"

/**
 * @category service
 * @since 1.0.0
 */
export const ConfigSchema = Schema.struct({
  "$schema": Schema.string,
  projectHomepage: Schema.string,
  srcDir: Schema.string,
  outDir: Schema.string,
  theme: Schema.string,
  enableSearch: Schema.boolean,
  enforceDescriptions: Schema.boolean,
  enforceExamples: Schema.boolean,
  enforceVersion: Schema.boolean,
  exclude: Schema.array(Schema.string),
  parseCompilerOptions: Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown)),
  examplesCompilerOptions: Schema.union(Schema.string, Schema.record(Schema.string, Schema.unknown))
})

/**
 * @category service
 * @since 1.0.0
 */
export const PartialConfigSchema = Schema.partial(ConfigSchema)
