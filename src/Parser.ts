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
import * as Order from "effect/Order"
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

const sortByName: <A extends { name: string }>(self: Iterable<A>) => Array<A> = Array.sort(
  pipe(
    String.Order,
    Order.mapInput(({ name }: { name: string }) => name)
  )
)

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

const hasTag = (tag: string) => (comment: Comment) => pipe(comment.tags, Record.get(tag), Option.isSome)

const hasInternalTag = hasTag("internal")

const hasIgnoreTag = hasTag("ignore")

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
    Option.map(String.trim),
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

const shouldNotIgnore = (jsdocs: ReadonlyArray<ast.JSDoc>): boolean => {
  const comment = parseComment(getJSDocText(jsdocs))
  return !hasInternalTag(comment) && !hasIgnoreTag(comment)
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
export const getDoc = (text: string) => {
  const comment = parseComment(text)
  return new Domain.Doc(
    comment.description,
    comment.tags["since"] ?? [],
    comment.tags["deprecated"] ?? [],
    comment.tags["example"] ?? [],
    comment.tags["category"] ?? [],
    comment.tags["throws"] ?? [],
    comment.tags["see"] ?? []
  )
}

const parseInterfaceDeclaration = (id: ast.InterfaceDeclaration) =>
  Effect.gen(function*() {
    const name = id.getName()
    const text = getJSDocText(id.getJsDocs())
    const doc = getDoc(text)
    const signature = id.getText()
    return new Domain.Interface(
      name,
      doc,
      signature
    )
  })

const parseInterfaceDeclarations = (interfaces: ReadonlyArray<ast.InterfaceDeclaration>) => {
  const exportedInterfaces = Array.filter(
    interfaces,
    (id) => id.isExported() && shouldNotIgnore(id.getJsDocs())
  )
  return Effect.forEach(exportedInterfaces, parseInterfaceDeclaration).pipe(
    Effect.map(sortByName)
  )
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

const parseFunctionDeclaration = (fd: ast.FunctionDeclaration) =>
  Effect.gen(function*() {
    const name = fd.getName()
    const text = getJSDocText(getFunctionDeclarationJSDocs(fd))
    const doc = getDoc(text)
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
    return new Domain.Function(
      name ?? "anonymous function",
      doc,
      signatures
    )
  })

const parseFunctionVariableDeclaration = (vd: ast.VariableDeclaration) =>
  Effect.gen(function*() {
    const vs: any = vd.getParent().getParent()
    const name = vd.getName()
    const text = getJSDocText(vs.getJsDocs())
    const doc = getDoc(text)
    const signature = `export declare const ${name}: ${
      stripImportTypes(
        vd.getType().getText(vd)
      )
    }`
    return new Domain.Function(
      name,
      doc,
      [signature]
    )
  })

const getFunctionDeclarations = Effect.gen(function*() {
  const source = yield* Source
  const functions = Array.filter(
    source.sourceFile.getFunctions(),
    (fd) => fd.isExported() && shouldNotIgnore(getFunctionDeclarationJSDocs(fd))
  )
  const arrows = pipe(
    Array.filter(
      source.sourceFile.getVariableDeclarations(),
      (vd) => {
        if (isVariableDeclarationList(vd.getParent())) {
          const vs: any = vd.getParent().getParent()
          if (isVariableStatement(vs)) {
            return vs.isExported() && shouldNotIgnore(vs.getJsDocs()) &&
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
  const functionDeclarations = yield* Effect.forEach(functions, parseFunctionDeclaration)
  const functionVariableDeclarations = yield* Effect.forEach(arrows, parseFunctionVariableDeclaration)
  return [...functionDeclarations, ...functionVariableDeclarations]
})

const parseTypeAliasDeclaration = (ta: ast.TypeAliasDeclaration) =>
  Effect.gen(function*() {
    const name = ta.getName()
    const text = getJSDocText(ta.getJsDocs())
    const doc = getDoc(text)
    const signature = ta.getText()
    return new Domain.TypeAlias(
      name,
      doc,
      signature
    )
  })

const parseTypeAliasDeclarations = (typeAliases: ReadonlyArray<ast.TypeAliasDeclaration>) => {
  const exportedTypeAliases = Array.filter(
    typeAliases,
    (tad) => tad.isExported() && shouldNotIgnore(tad.getJsDocs())
  )
  return Effect.forEach(exportedTypeAliases, parseTypeAliasDeclaration).pipe(
    Effect.map(sortByName)
  )
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
    const name = vd.getName()
    const text = getJSDocText(vs.getJsDocs())
    const doc = getDoc(text)
    const type = stripImportTypes(vd.getType().getText(vd))
    const signature = `export declare const ${name}: ${type}`
    return new Domain.Constant(
      name,
      doc,
      signature
    )
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
            return vs.isExported() && shouldNotIgnore(vs.getJsDocs()) &&
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
  return yield* Effect.forEach(variableDeclarations, parseConstantVariableDeclaration)
})

const parseExportSpecifier = (es: ast.ExportSpecifier) =>
  Effect.gen(function*() {
    const name = es.compilerNode.name.text
    const type = stripImportTypes(es.getType().getText(es))
    const ocommentRange = Array.head(es.getLeadingCommentRanges())
    const text = ocommentRange.pipe(Option.map((range) => range.getText()), Option.getOrElse(() => ""))
    const doc = getDoc(text)
    const signature = `export declare const ${name}: ${type}`
    return new Domain.Export(
      name,
      doc,
      signature,
      false
    )
  })

const parseExportStar = (
  ed: ast.ExportDeclaration
) =>
  Effect.gen(function*() {
    const es = ed.getModuleSpecifier()!
    const name = es.getText()
    const namespace = ed.getNamespaceExport()?.getName()
    const signature = `export *${namespace === undefined ? "" : ` as ${namespace}`} from ${name}`
    const ocommentRange = Array.head(ed.getLeadingCommentRanges())
    const text = ocommentRange.pipe(Option.map((range) => range.getText()), Option.getOrElse(() => ""))
    const doc = getDoc(text)
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
): Effect.Effect<Domain.Namespace, never, Source | Configuration.Configuration> =>
  Effect.flatMap(Source, (_source) => {
    const name = ed.getName()
    const text = getJSDocText(ed.getJsDocs())
    const doc = getDoc(text)
    const getInterfaces = parseInterfaceDeclarations(ed.getInterfaces())
    const getTypeAliases = parseTypeAliasDeclarations(
      ed.getTypeAliases()
    )
    const getNamespaces = parseModuleDeclarations(ed.getModules())
    return Effect.gen(function*() {
      const interfaces = yield* getInterfaces
      const typeAliases = yield* getTypeAliases
      const namespaces = yield* getNamespaces
      return new Domain.Namespace(
        name,
        doc,
        interfaces,
        typeAliases,
        namespaces
      )
    })
  })

const parseModuleDeclarations = (namespaces: ReadonlyArray<ast.ModuleDeclaration>) => {
  const exportedNamespaces = Array.filter(
    namespaces,
    (md) => md.isExported() && shouldNotIgnore(md.getJsDocs())
  )
  return Effect.forEach(exportedNamespaces, parseModuleDeclaration).pipe(
    Effect.mapBoth({
      onFailure: Array.flatten,
      onSuccess: sortByName
    })
  )
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
    if (shouldNotIgnore(jsdocs)) {
      const text = getJSDocText(jsdocs)
      const doc = getDoc(text)
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
    }
    return Option.none()
  })

const parseProperty = (pd: ast.PropertyDeclaration) =>
  Effect.gen(function*() {
    const name = pd.getName()
    const text = getJSDocText(pd.getJsDocs())
    const doc = getDoc(text)
    const type = stripImportTypes(pd.getType().getText(pd))
    const readonly = pipe(
      Option.fromNullable(
        pd.getFirstModifierByKind(ast.ts.SyntaxKind.ReadonlyKeyword)
      ),
      Option.match({
        onNone: () => "",
        onSome: () => "readonly "
      })
    )
    const signature = `${readonly}${name}: ${type}`
    return new Domain.Property(
      name,
      doc,
      signature
    )
  })

const parseProperties = (name: string, c: ast.ClassDeclaration) => {
  const properties = Array.filter(
    c.getProperties(),
    (pd) =>
      !pd.isStatic() && shouldNotIgnore(pd.getJsDocs()) && pipe(
        pd.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword),
        Option.fromNullable,
        Option.isNone
      )
  )
  return Effect.forEach(properties, parseProperty)
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

const getClassDoc = (name: string, c: ast.ClassDeclaration) => {
  const text = getJSDocText(c.getJsDocs())
  return getDoc(text)
}

const getClassDeclarationSignature = (name: string, c: ast.ClassDeclaration) =>
  pipe(
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

const parseClass = (c: ast.ClassDeclaration) =>
  Effect.gen(function*() {
    const name = c.getName() ?? "anonymous class"
    const doc = getClassDoc(name, c)
    const signature = yield* getClassDeclarationSignature(name, c)
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
    const properties = yield* parseProperties(name, c)
    return new Domain.Class(
      name,
      doc,
      signature,
      methods,
      staticMethods,
      properties
    )
  })

/**
 * @category parsers
 * @since 0.6.0
 */
export const parseClasses = Effect.gen(function*() {
  const source = yield* Source
  const exportedClasses = Array.filter(
    source.sourceFile.getClasses(),
    (cd) => cd.isExported() && shouldNotIgnore(cd.getJsDocs())
  )
  return yield* Effect.forEach(exportedClasses, parseClass).pipe(
    Effect.map(sortByName)
  )
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
      return getDoc(text)
    }
  }
  return getDoc("")
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
  const path = yield* Path.Path
  const name = path.parse(Array.lastNonEmpty(source.path)).name
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
export const parseFile = (project: ast.Project) =>
(file: Domain.File): Effect.Effect<
  Domain.Module,
  Array<string>,
  Configuration.Configuration | Path.Path
> =>
  Effect.flatMap(Path.Path, (_) => {
    const path = file.path.split(
      _.sep
    ) as any as Array.NonEmptyReadonlyArray<string>
    const sourceFile = project.getSourceFile(file.path)
    if (sourceFile !== undefined) {
      return pipe(
        parseModule,
        Effect.provideService(Source, { path, sourceFile })
      )
    }
    return Effect.fail([`Unable to locate file: ${file.path}`])
  })

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
