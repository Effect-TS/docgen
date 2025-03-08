/**
 * @since 0.6.0
 */
import * as Path from "@effect/platform/Path"
import * as doctrine from "doctrine"
import * as Array from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Record from "effect/Record"
import * as String from "effect/String"
import * as ast from "ts-morph"
import * as Configuration from "./Configuration.js"
import * as Domain from "./Domain.js"

/** @internal */
export interface SourceShape {
  readonly path: Array.NonEmptyReadonlyArray<string>
  readonly sourceFile: ast.SourceFile
}

/** @internal */
export class Source extends Context.Tag("Source")<Source, SourceShape>() {}

const sortModulesByPath: <A extends Domain.Module>(self: Iterable<A>) => Array<A> = Array
  .sort(Domain.ByPath)

/**
 * @internal
 */
export const stripImportTypes = (s: string): string => s.replace(/import\("((?!").)*"\)./g, "")

const getJSDocText: (jsdocs: ReadonlyArray<ast.JSDoc>) => string = Array.matchRight({
  onEmpty: () => "",
  onNonEmpty: (_, last) => last.getText()
})

class Comment {
  constructor(
    readonly description: string | undefined,
    readonly tags: Record<string, ReadonlyArray<string> | undefined>
  ) {}
}

/**
 * @internal
 */
export const parseComment = (text: string): Comment => {
  const annotation: doctrine.Annotation = doctrine.parse(text, {
    unwrap: true
  })

  const description = pipe(
    Option.fromNullable(annotation.description),
    Option.map((s) => s.trim()),
    Option.filter(String.isNonEmpty),
    Option.getOrUndefined
  )

  const tags = pipe(
    annotation.tags,
    Array.groupBy((tag) => tag.title),
    Record.map((values) =>
      Array.map(values, (tag) =>
        pipe(
          Option.fromNullable(tag.description),
          Option.map(String.trim),
          Option.getOrElse(() => "")
        ))
    )
  )

  return { description, tags }
}

const isVariableDeclarationList = (
  u: ast.VariableDeclarationList | ast.CatchClause
): u is ast.VariableDeclarationList => u.getKind() === ast.ts.SyntaxKind.VariableDeclarationList

const isVariableStatement = (
  u:
    | ast.VariableStatement
    | ast.ForStatement
    | ast.ForOfStatement
    | ast.ForInStatement
): u is ast.VariableStatement => u.getKind() === ast.ts.SyntaxKind.VariableStatement

/**
 * @internal
 */
export const parseDoc = (text: string) => {
  const comment = parseComment(text)
  return new Domain.Doc(
    comment.description,
    comment.tags["since"] ?? [],
    comment.tags["deprecated"] ?? [],
    comment.tags["example"] ?? [],
    comment.tags["category"] ?? [],
    comment.tags["throws"] ?? [],
    comment.tags["see"] ?? [],
    comment.tags
  )
}

const shouldIgnore = (doc: Domain.Doc): boolean => {
  return Record.has(doc.tags, "internal") || Record.has(doc.tags, "ignore")
}

const parseInterfaceDeclaration = (id: ast.InterfaceDeclaration) =>
  Effect.gen(function*() {
    const text = getJSDocText(id.getJsDocs())
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = id.getName()
    const signature = id.getText()
    return [
      new Domain.Interface(
        name,
        doc,
        signature
      )
    ]
  })

const parseInterfaceDeclarations = (interfaces: ReadonlyArray<ast.InterfaceDeclaration>) => {
  const exportedInterfaces = Array.filter(
    interfaces,
    (id) => id.isExported()
  )
  return Effect.forEach(exportedInterfaces, parseInterfaceDeclaration).pipe(Effect.map(Array.flatten))
}

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseInterfaces = Effect.flatMap(
  Source,
  (source) => parseInterfaceDeclarations(source.sourceFile.getInterfaces())
)

const getFunctionDeclarationSignature = (
  f: ast.FunctionDeclaration
): string => {
  const text = f.getText()
  return pipe(
    Option.fromNullable(f.compilerNode.body),
    Option.match({
      onNone: () => text.replace("export function ", "export declare function "),
      onSome: (body) => {
        const end = body.getStart() - f.getStart() - 1
        return text
          .substring(0, end)
          .replace("export function ", "export declare function ")
      }
    })
  )
}

const getFunctionDeclarationJSDocs = (
  fd: ast.FunctionDeclaration
): Array<ast.JSDoc> =>
  pipe(
    fd.getOverloads(),
    Array.matchLeft({
      onEmpty: () => fd.getJsDocs(),
      onNonEmpty: (firstOverload) => firstOverload.getJsDocs()
    })
  )

const parsePosition = (node: ast.Node): Effect.Effect<Domain.Position, never, Source> => {
  return Effect.gen(function*() {
    const source = yield* Source
    const startPos = node.getStart()
    const position = source.sourceFile.getLineAndColumnAtPos(startPos)
    return position
  })
}

const parseFunctionDeclaration = (fd: ast.FunctionDeclaration) =>
  Effect.gen(function*() {
    const text = getJSDocText(getFunctionDeclarationJSDocs(fd))
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = fd.getName()
    const signatures = pipe(
      fd.getOverloads(),
      Array.matchRight({
        onEmpty: () => [getFunctionDeclarationSignature(fd)],
        onNonEmpty: (init, last) =>
          pipe(
            init.map(getFunctionDeclarationSignature),
            Array.append(getFunctionDeclarationSignature(last))
          )
      })
    )
    const position = yield* parsePosition(fd)
    return [
      new Domain.Function(
        position,
        name ?? "",
        doc,
        signatures
      )
    ]
  })

const parseFunctionVariableDeclaration = (vd: ast.VariableDeclaration) =>
  Effect.gen(function*() {
    const vs: any = vd.getParent().getParent()
    const text = getJSDocText(vs.getJsDocs())
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = vd.getName()
    const signature = `export declare const ${name}: ${
      stripImportTypes(
        vd.getType().getText(vd)
      )
    }`
    const startPos = vd.getStart()
    const source = yield* Source
    const position = source.sourceFile.getLineAndColumnAtPos(startPos)
    return [
      new Domain.Function(
        position,
        name ?? "",
        doc,
        [signature]
      )
    ]
  })

const getFunctionDeclarations = Effect.gen(function*() {
  const source = yield* Source
  const functions = Array.filter(
    source.sourceFile.getFunctions(),
    (fd) => fd.isExported()
  )
  const arrows = pipe(
    Array.filter(
      source.sourceFile.getVariableDeclarations(),
      (vd) => {
        if (isVariableDeclarationList(vd.getParent())) {
          const vs: any = vd.getParent().getParent()
          if (isVariableStatement(vs)) {
            return vs.isExported() &&
              Option.fromNullable(vd.getInitializer()).pipe(
                Option.filter((expr) => ast.Node.isFunctionLikeDeclaration(expr)),
                Option.isSome
              )
          }
        }
        return false
      }
    )
  )
  return { functions, arrows }
})

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseFunctions = Effect.gen(function*() {
  const { arrows, functions } = yield* getFunctionDeclarations
  const functionDeclarations = yield* Effect.forEach(functions, parseFunctionDeclaration).pipe(
    Effect.map(Array.flatten)
  )
  const functionVariableDeclarations = yield* Effect.forEach(arrows, parseFunctionVariableDeclaration).pipe(
    Effect.map(Array.flatten)
  )
  return [...functionDeclarations, ...functionVariableDeclarations]
})

const parseTypeAliasDeclaration = (ta: ast.TypeAliasDeclaration) =>
  Effect.gen(function*() {
    const text = getJSDocText(ta.getJsDocs())
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = ta.getName()
    const signature = ta.getText()
    return [
      new Domain.TypeAlias(
        name,
        doc,
        signature
      )
    ]
  })

const parseTypeAliasDeclarations = (typeAliases: ReadonlyArray<ast.TypeAliasDeclaration>) => {
  const exportedTypeAliases = Array.filter(
    typeAliases,
    (tad) => tad.isExported()
  )
  return Effect.forEach(exportedTypeAliases, parseTypeAliasDeclaration).pipe(Effect.map(Array.flatten))
}

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseTypeAliases = Effect.flatMap(
  Source,
  (source) => parseTypeAliasDeclarations(source.sourceFile.getTypeAliases())
)

const parseConstantVariableDeclaration = (vd: ast.VariableDeclaration) =>
  Effect.gen(function*() {
    const vs: any = vd.getParent().getParent()
    const text = getJSDocText(vs.getJsDocs())
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = vd.getName()
    const type = stripImportTypes(vd.getType().getText(vd))
    const signature = `export declare const ${name}: ${type}`
    return [
      new Domain.Constant(
        name,
        doc,
        signature
      )
    ]
  })

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseConstants = Effect.gen(function*() {
  const source = yield* Source
  const variableDeclarations = pipe(
    Array.filter(
      source.sourceFile.getVariableDeclarations(),
      (vd) => {
        if (isVariableDeclarationList(vd.getParent())) {
          const vs: any = vd.getParent().getParent()
          if (isVariableStatement(vs)) {
            return vs.isExported() &&
              Option.fromNullable(vd.getInitializer()).pipe(
                Option.filter((expr) => !ast.Node.isFunctionLikeDeclaration(expr)),
                Option.isSome
              )
          }
        }
        return false
      }
    )
  )
  return yield* Effect.forEach(variableDeclarations, parseConstantVariableDeclaration).pipe(
    Effect.map(Array.flatten)
  )
})

const parseExportSpecifier = (es: ast.ExportSpecifier) =>
  Effect.gen(function*() {
    const name = es.compilerNode.name.text
    const type = stripImportTypes(es.getType().getText(es))
    const ocommentRange = Array.head(es.getLeadingCommentRanges())
    const text = ocommentRange.pipe(Option.map((range) => range.getText()), Option.getOrElse(() => ""))
    const doc = parseDoc(text)
    const signature = `export declare const ${name}: ${type}`
    return new Domain.Export(
      name,
      doc,
      signature,
      false
    )
  })

const parseExportStar = (ed: ast.ExportDeclaration) =>
  Effect.gen(function*() {
    const es = ed.getModuleSpecifier()!
    const name = es.getText()
    const namespace = ed.getNamespaceExport()?.getName()
    const signature = `export *${namespace === undefined ? "" : ` as ${namespace}`} from ${name}`
    const ocommentRange = Array.head(ed.getLeadingCommentRanges())
    const text = ocommentRange.pipe(Option.map((range) => range.getText()), Option.getOrElse(() => ""))
    const doc = parseDoc(text)
    return new Domain.Export(
      namespace ?? name,
      doc.modifyDescription(
        `Re-exports all named exports from the ${name} module${namespace === undefined ? "" : ` as \`${namespace}\``}.`
      ),
      signature,
      true
    )
  })

const parseNamedExports = (ed: ast.ExportDeclaration) => {
  const namedExports = ed.getNamedExports()
  if (namedExports.length === 0) {
    return parseExportStar(ed).pipe(Effect.map(Array.of))
  }
  return Effect.forEach(namedExports, parseExportSpecifier)
}

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseExports = pipe(
  Effect.map(Source, (source) => source.sourceFile.getExportDeclarations()),
  Effect.flatMap((exportDeclarations) => Effect.forEach(exportDeclarations, parseNamedExports)),
  Effect.map(Array.flatten)
)

const parseModuleDeclaration = (
  ed: ast.ModuleDeclaration
): Effect.Effect<Array<Domain.Namespace>, never, Source | Configuration.Configuration> => {
  const text = getJSDocText(ed.getJsDocs())
  const doc = parseDoc(text)
  if (shouldIgnore(doc)) {
    return Effect.succeed([])
  }
  const name = ed.getName()
  const getInterfaces = parseInterfaceDeclarations(ed.getInterfaces())
  const getTypeAliases = parseTypeAliasDeclarations(
    ed.getTypeAliases()
  )
  const getNamespaces = parseModuleDeclarations(ed.getModules())
  return Effect.gen(function*() {
    const interfaces = yield* getInterfaces
    const typeAliases = yield* getTypeAliases
    const namespaces = yield* getNamespaces
    return [
      new Domain.Namespace(
        name,
        doc,
        interfaces,
        typeAliases,
        namespaces
      )
    ]
  })
}

const parseModuleDeclarations = (namespaces: ReadonlyArray<ast.ModuleDeclaration>) => {
  const exportedNamespaces = Array.filter(
    namespaces,
    (md) => md.isExported()
  )
  return Effect.forEach(exportedNamespaces, parseModuleDeclaration).pipe(Effect.map(Array.flatten))
}

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseNamespaces = Effect.flatMap(
  Source,
  (source) => parseModuleDeclarations(source.sourceFile.getModules())
)

const getTypeParameters = (
  tps: ReadonlyArray<ast.TypeParameterDeclaration>
): string => tps.length === 0 ? "" : `<${tps.map((p) => p.getName()).join(", ")}>`

const getMethodSignature = (md: ast.MethodDeclaration): string =>
  pipe(
    Option.fromNullable(md.compilerNode.body),
    Option.match({
      onNone: () => md.getText(),
      onSome: (body) => {
        const end = body.getStart() - md.getStart() - 1
        return md.getText().substring(0, end)
      }
    })
  )

const parseMethod = (md: ast.MethodDeclaration) =>
  Effect.gen(function*() {
    const name = md.getName()
    const overloads = md.getOverloads()
    const jsdocs = pipe(
      overloads,
      Array.matchLeft({
        onEmpty: () => md.getJsDocs(),
        onNonEmpty: (x) => x.getJsDocs()
      })
    )
    const text = getJSDocText(jsdocs)
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return Option.none()
    }
    const signatures = pipe(
      overloads,
      Array.matchRight({
        onEmpty: () => [getMethodSignature(md)],
        onNonEmpty: (init, last) =>
          pipe(
            init.map((md) => md.getText()),
            Array.append(getMethodSignature(last))
          )
      })
    )
    return Option.some(
      new Domain.Method(
        name,
        doc,
        signatures
      )
    )
  })

const parseProperty = (pd: ast.PropertyDeclaration) =>
  Effect.gen(function*() {
    const text = getJSDocText(pd.getJsDocs())
    const doc = parseDoc(text)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = pd.getName()
    const type = stripImportTypes(pd.getType().getText(pd))
    const readonly = pipe(
      Option.fromNullable(pd.getFirstModifierByKind(ast.ts.SyntaxKind.ReadonlyKeyword)),
      Option.match({
        onNone: () => "",
        onSome: () => "readonly "
      })
    )
    const signature = `${readonly}${name}: ${type}`
    return [new Domain.Property(name, doc, signature)]
  })

const parseProperties = (c: ast.ClassDeclaration) => {
  const properties = Array.filter(
    c.getProperties(),
    (pd) =>
      !pd.isStatic() && pipe(
        pd.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword),
        Option.fromNullable,
        Option.isNone
      )
  )
  return Effect.forEach(properties, parseProperty).pipe(Effect.map(Array.flatten))
}

/**
 * @internal
 */
export const getConstructorDeclarationSignature = (
  c: ast.ConstructorDeclaration
): string =>
  pipe(
    Option.fromNullable(c.compilerNode.body),
    Option.match({
      onNone: () => c.getText(),
      onSome: (body) => {
        const end = body.getStart() - c.getStart() - 1
        return c.getText().substring(0, end)
      }
    })
  )

const getClassDoc = (c: ast.ClassDeclaration) => {
  const text = getJSDocText(c.getJsDocs())
  return parseDoc(text)
}

const getClassDeclarationSignature = (c: ast.ClassDeclaration) => {
  const name = c.getName() ?? ""
  return pipe(
    Effect.succeed(getTypeParameters(c.getTypeParameters())),
    Effect.map((typeParameters) =>
      pipe(
        c.getConstructors(),
        Array.matchLeft({
          onEmpty: () => `export declare class ${name}${typeParameters}`,
          onNonEmpty: (head) =>
            `export declare class ${name}${typeParameters} { ${
              getConstructorDeclarationSignature(
                head
              )
            } }`
        })
      )
    )
  )
}

const parseClass = (c: ast.ClassDeclaration) =>
  Effect.gen(function*() {
    const doc = getClassDoc(c)
    if (shouldIgnore(doc)) {
      return []
    }
    const name = c.getName() ?? ""
    const signature = yield* getClassDeclarationSignature(c)
    const methods = yield* pipe(
      c.getInstanceMethods(),
      Effect.forEach(parseMethod),
      Effect.map(Array.getSomes)
    )
    const staticMethods = yield* pipe(
      c.getStaticMethods(),
      Effect.forEach(parseMethod),
      Effect.map(Array.getSomes)
    )
    const properties = yield* parseProperties(c)
    return [
      new Domain.Class(
        name,
        doc,
        signature,
        methods,
        staticMethods,
        properties
      )
    ]
  })

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseClasses = Effect.gen(function*() {
  const source = yield* Source
  const exportedClasses = Array.filter(
    source.sourceFile.getClasses(),
    (cd) => cd.isExported()
  )
  return yield* Effect.forEach(exportedClasses, parseClass).pipe(Effect.map(Array.flatten))
})

/**
 * @internal
 */
export const parseModuleDocumentation = Effect.gen(function*() {
  const source = yield* Source
  const statements = source.sourceFile.getStatements()
  const ofirstStatement = Array.head(statements)
  if (Option.isSome(ofirstStatement)) {
    const firstStatement = ofirstStatement.value
    const ocommentRange = Array.head(firstStatement.getLeadingCommentRanges())
    if (Option.isSome(ocommentRange)) {
      const commentRange = ocommentRange.value
      const text = commentRange.getText()
      return parseDoc(text)
    }
  }
  return parseDoc("")
})

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseModule = Effect.gen(function*() {
  const source = yield* Source
  const doc = yield* parseModuleDocumentation
  const interfaces = yield* parseInterfaces
  const functions = yield* parseFunctions
  const typeAliases = yield* parseTypeAliases
  const classes = yield* parseClasses
  const constants = yield* parseConstants
  const exports = yield* parseExports
  const namespaces = yield* parseNamespaces
  const name = source.sourceFile.getBaseName()
  return new Domain.Module(
    name,
    doc,
    source.path,
    classes,
    interfaces,
    functions,
    typeAliases,
    constants,
    exports,
    namespaces
  )
})

/**
 * @internal
 */
export const parseFile =
  (project: ast.Project) =>
  (file: Domain.File): Effect.Effect<Domain.Module, Array<string>, Configuration.Configuration | Path.Path> => {
    return Effect.gen(function*() {
      const path = yield* Path.Path
      const filePath = file.path.split(path.sep)
      const sourceFile = project.getSourceFile(file.path)
      if (sourceFile !== undefined && Array.isNonEmptyArray(filePath)) {
        return yield* Effect.provideService(parseModule, Source, { sourceFile, path: filePath })
      }
      return yield* Effect.fail([`Unable to locate file: ${file.path}`])
    })
  }

const createProject = (files: ReadonlyArray<Domain.File>) =>
  Effect.gen(function*() {
    const config = yield* Configuration.Configuration
    const process = yield* Domain.Process
    const cwd = yield* process.cwd
    // Convert the raw config into a format that TS/TS-Morph expects
    const parsed = ast.ts.parseJsonConfigFileContent(
      {
        compilerOptions: {
          strict: true,
          moduleResolution: "node",
          ...config.parseCompilerOptions
        }
      },
      ast.ts.sys,
      cwd
    )

    const options: ast.ProjectOptions = {
      compilerOptions: parsed.options
    }
    const project = new ast.Project(options)
    for (const file of files) {
      project.addSourceFileAtPath(file.path)
    }
    return project
  })

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseFiles = (files: ReadonlyArray<Domain.File>) =>
  createProject(files).pipe(
    Effect.flatMap((project) =>
      pipe(
        files,
        Effect.validateAll(parseFile(project)),
        Effect.map(sortModulesByPath)
      )
    )
  )
