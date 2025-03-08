/**
 * @since 0.6.0
 */
import { codeFrameColumns } from "@babel/code-frame"
import { Array, Effect } from "effect"
import type * as Domain from "./Domain.js"
import * as Parser from "./Parser.js"

function checkFunction(model: Domain.Function) {
  return Effect.gen(function*() {
    const since = model.doc.since
    if (since.length === 0) {
      const source = yield* Parser.Source
      const location = { start: model.position }
      const result = codeFrameColumns(source.sourceFile.getFullText(), location)
      return [`Missing \`@since\` tag in file ${source.sourceFile.getFilePath()}:\n\n${result}`]
    }
    return []
  })
}

/**
 * @since 0.6.0
 */
export function checkFunctions(functions: ReadonlyArray<Domain.Function>) {
  return Effect.forEach(functions, checkFunction).pipe(Effect.map(Array.flatten))
}

/**
 * @since 0.6.0
 */
export function checkClasses(_classes: ReadonlyArray<Domain.Class>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkConstants(_constants: ReadonlyArray<Domain.Constant>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkInterfaces(_interfaces: ReadonlyArray<Domain.Interface>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkTypeAliases(_typeAliases: ReadonlyArray<Domain.TypeAlias>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkNamespaces(_namespaces: ReadonlyArray<Domain.Namespace>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkExports(_exports: ReadonlyArray<Domain.Export>) {
  return Effect.succeed([])
}

/**
 * @since 0.6.0
 */
export function checkModule(_module: Domain.Module) {
  return Effect.succeed([])
}
