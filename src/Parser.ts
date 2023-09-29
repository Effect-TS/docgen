/**
 * @since 1.0.0
 */
import chalk from "chalk"
import * as doctrine from "doctrine"
import {
  Context,
  Effect,
  Option,
  Order,
  Predicate,
  ReadonlyArray,
  ReadonlyRecord,
  String
} from "effect"
import { flow, pipe } from "effect/Function"
import * as NodePath from "node:path"
import * as ast from "ts-morph"
import * as Config from "./Config"
import * as Domain from "./Domain"
import type * as FileSystem from "./FileSystem"
import * as Process from "./Process"

/** @internal */
export interface Source {
  readonly path: ReadonlyArray.NonEmptyReadonlyArray<string>
  readonly sourceFile: ast.SourceFile
}

/** @internal */
export const Source = Context.Tag<Source>()

interface Comment {
  readonly description: Option.Option<string>
  readonly tags: ReadonlyRecord.ReadonlyRecord<
    ReadonlyArray.NonEmptyReadonlyArray<Option.Option<string>>
  >
}

const sortByName: <A extends { name: string }>(self: Iterable<A>) => Array<A> = ReadonlyArray.sort(
  pipe(
    String.Order,
    Order.mapInput(({ name }: { name: string }) => name)
  )
)

const sortModulesByPath: <A extends Domain.Module>(self: Iterable<A>) => Array<A> = ReadonlyArray
  .sort(Domain.ByPath)

/**
 * @internal
 */
export const stripImportTypes = (s: string): string => s.replace(/import\("((?!").)*"\)./g, "")

const getJSDocText: (jsdocs: ReadonlyArray<ast.JSDoc>) => string = ReadonlyArray.matchRight({
  onEmpty: () => "",
  onNonEmpty: (_, last) => last.getText()
})

const hasTag = (tag: string) => (comment: Comment) =>
  pipe(comment.tags, ReadonlyRecord.get(tag), Option.isSome)

const hasInternalTag = hasTag("internal")

const hasIgnoreTag = hasTag("ignore")

const shouldIgnore: Predicate.Predicate<Comment> = Predicate.some([hasInternalTag, hasIgnoreTag])

/**
 * @internal
 */
export const parseComment = (text: string): Comment => {
  const annotation: doctrine.Annotation = doctrine.parse(text, {
    unwrap: true
  })
  const tags = pipe(
    annotation.tags,
    ReadonlyArray.groupBy((tag) => tag.title),
    ReadonlyRecord.map(
      ReadonlyArray.mapNonEmpty((tag) =>
        pipe(
          Option.fromNullable(tag.description),
          Option.filter(String.isNonEmpty)
        )
      )
    )
  )
  const description = pipe(
    Option.fromNullable(annotation.description),
    Option.filter(String.isNonEmpty)
  )
  return { description, tags }
}

const shouldNotIgnore = Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))

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

const getMissingTagError = (
  tag: string,
  path: ReadonlyArray<string>,
  name: string
): string =>
  `Missing ${chalk.bold(tag)} tag in ${chalk.bold(path.join("/") + "#" + name)} documentation`

const getSinceTag = (name: string, comment: Comment) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const source = yield* _(Source)
    const since = ReadonlyRecord.get(comment.tags, "since").pipe(
      Option.flatMap(ReadonlyArray.headNonEmpty),
      Option.map(String.trim),
      Option.filter(String.isNonEmpty)
    )
    if (
      Option.isNone(since) && (config.enforceVersion || ReadonlyRecord.has(comment.tags, "since"))
    ) {
      return yield* _(Effect.fail(getMissingTagError("@since", source.path, name)))
    }
    return since
  })

const getCategoryTag = (name: string, comment: Comment) =>
  Effect.gen(function*(_) {
    const source = yield* _(Source)
    const category = ReadonlyRecord.get(comment.tags, "category").pipe(
      Option.flatMap(ReadonlyArray.headNonEmpty),
      Option.map(String.trim),
      Option.filter(String.isNonEmpty)
    )
    if (
      Option.isNone(category) && (ReadonlyRecord.has(comment.tags, "category"))
    ) {
      return yield* _(Effect.fail(getMissingTagError("@category", source.path, name)))
    }
    return category
  })

const getDescription = (name: string, comment: Comment) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const source = yield* _(Source)
    if (Option.isNone(comment.description) && config.enforceDescriptions) {
      return yield* _(
        Effect.fail(
          `Missing ${chalk.bold("description")} in ${
            chalk.bold(source.path.join("/") + "#" + name)
          } documentation`
        )
      )
    }
    return comment.description
  })

const getExamplesTag = (name: string, comment: Comment, isModule: boolean) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const source = yield* _(Source)
    const examples = ReadonlyRecord.get(comment.tags, "example").pipe(
      Option.map(ReadonlyArray.compact),
      Option.getOrElse(() => [])
    )
    if (ReadonlyArray.isEmptyArray(examples) && config.enforceExamples && !isModule) {
      return yield* _(Effect.fail(getMissingTagError("@example", source.path, name)))
    }
    return examples
  })

/**
 * @internal
 */
export const getDoc = (name: string, text: string, isModule = false) =>
  Effect.gen(function*(_) {
    const comment = parseComment(text)
    const since = yield* _(getSinceTag(name, comment))
    const category = yield* _(getCategoryTag(name, comment))
    const description = yield* _(getDescription(name, comment))
    const examples = yield* _(getExamplesTag(name, comment, isModule))
    const deprecated = Option.isSome(ReadonlyRecord.get(comment.tags, "deprecated"))
    return Domain.createDoc(
      description,
      since,
      deprecated,
      examples,
      category
    )
  })

const parseInterfaceDeclaration = (id: ast.InterfaceDeclaration) =>
  Effect.gen(function*(_) {
    const name = id.getName()
    const text = getJSDocText(id.getJsDocs())
    const doc = yield* _(getDoc(name, text))
    const signature = id.getText()
    return Domain.createInterface(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature
    )
  })

const parseInterfaces_ = (interfaces: ReadonlyArray<ast.InterfaceDeclaration>) =>
  pipe(
    interfaces,
    ReadonlyArray.filter(
      Predicate.every<ast.InterfaceDeclaration>([
        (id) => id.isExported(),
        (id) => pipe(id.getJsDocs(), shouldNotIgnore)
      ])
    ),
    Effect.validateAll(parseInterfaceDeclaration),
    Effect.map(sortByName)
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseInterfaces = Effect.flatMap(
  Source,
  (source) => parseInterfaces_(source.sourceFile.getInterfaces())
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
    ReadonlyArray.matchLeft({
      onEmpty: () => fd.getJsDocs(),
      onNonEmpty: (firstOverload) => firstOverload.getJsDocs()
    })
  )

const parseFunctionDeclaration = (fd: ast.FunctionDeclaration) =>
  Effect.gen(function*(_) {
    const source = yield* _(Source)
    const name = yield* _(pipe(
      Option.fromNullable(fd.getName()),
      Option.flatMap(Option.liftPredicate((name) => name.length > 0)),
      Effect.mapError(
        () =>
          `Missing ${chalk.bold("function name")} in module ${chalk.bold(source.path.join("/"))}`
      )
    ))
    const text = getJSDocText(getFunctionDeclarationJSDocs(fd))
    const doc = yield* _(getDoc(name, text))
    const signatures = pipe(
      fd.getOverloads(),
      ReadonlyArray.matchRight({
        onEmpty: () => [getFunctionDeclarationSignature(fd)],
        onNonEmpty: (init, last) =>
          pipe(
            init.map(getFunctionDeclarationSignature),
            ReadonlyArray.append(getFunctionDeclarationSignature(last))
          )
      })
    )
    return Domain.createFunction(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signatures
    )
  })

const parseFunctionVariableDeclaration = (vd: ast.VariableDeclaration) =>
  Effect.gen(function*(_) {
    const vs: any = vd.getParent().getParent()
    const name = vd.getName()
    const text = getJSDocText(vs.getJsDocs())
    const doc = yield* _(getDoc(name, text))
    const signature = `export declare const ${name}: ${
      stripImportTypes(
        vd.getType().getText(vd)
      )
    }`
    return Domain.createFunction(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      [signature]
    )
  })

const getFunctionDeclarations = pipe(
  Effect.map(Source, (source) => ({
    functions: pipe(
      source.sourceFile.getFunctions(),
      ReadonlyArray.filter(
        Predicate.every<ast.FunctionDeclaration>([
          (fd) => fd.isExported(),
          (fd) => pipe(getFunctionDeclarationJSDocs(fd), shouldNotIgnore)
        ])
      )
    ),
    arrows: pipe(
      source.sourceFile.getVariableDeclarations(),
      ReadonlyArray.filter(
        Predicate.every<ast.VariableDeclaration>([
          (vd) => isVariableDeclarationList(vd.getParent()),
          (vd) => isVariableStatement(vd.getParent().getParent() as any),
          (vd) =>
            pipe(
              vd.getInitializer(),
              Predicate.every([
                flow(
                  Option.fromNullable,
                  Option.flatMap(
                    Option.liftPredicate(ast.Node.isFunctionLikeDeclaration)
                  ),
                  Option.isSome
                ),
                () =>
                  pipe(
                    (vd.getParent().getParent() as ast.VariableStatement).getJsDocs(),
                    shouldNotIgnore
                  ),
                () =>
                  (
                    vd.getParent().getParent() as ast.VariableStatement
                  ).isExported()
              ])
            )
        ])
      )
    )
  }))
)

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseFunctions = Effect.gen(function*(_) {
  const { arrows, functions } = yield* _(getFunctionDeclarations)
  const functionDeclarations = yield* _(Effect.validateAll(functions, parseFunctionDeclaration))
  const functionVariableDeclarations = yield* _(
    Effect.validateAll(arrows, parseFunctionVariableDeclaration)
  )
  return [...functionDeclarations, ...functionVariableDeclarations]
})

const parseTypeAliasDeclaration = (ta: ast.TypeAliasDeclaration) =>
  Effect.gen(function*(_) {
    const name = ta.getName()
    const text = getJSDocText(ta.getJsDocs())
    const doc = yield* _(getDoc(name, text))
    const signature = ta.getText()
    return Domain.createTypeAlias(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature
    )
  })

const parseTypeAliases_ = (typeAliases: ReadonlyArray<ast.TypeAliasDeclaration>) =>
  pipe(
    typeAliases,
    ReadonlyArray.filter(
      Predicate.every<ast.TypeAliasDeclaration>([
        (alias) => alias.isExported(),
        (alias) => pipe(alias.getJsDocs(), shouldNotIgnore)
      ])
    ),
    Effect.validateAll(parseTypeAliasDeclaration),
    Effect.map(sortByName)
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseTypeAliases = Effect.flatMap(
  Source,
  (source) => parseTypeAliases_(source.sourceFile.getTypeAliases())
)

const parseConstantVariableDeclaration = (vd: ast.VariableDeclaration) =>
  Effect.gen(function*(_) {
    const vs: any = vd.getParent().getParent()
    const name = vd.getName()
    const text = getJSDocText(vs.getJsDocs())
    const doc = yield* _(getDoc(name, text))
    const type = stripImportTypes(vd.getType().getText(vd))
    const signature = `export declare const ${name}: ${type}`
    return Domain.createConstant(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature
    )
  })

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseConstants = pipe(
  Effect.map(Source, (source) =>
    pipe(
      source.sourceFile.getVariableDeclarations(),
      ReadonlyArray.filter(
        Predicate.every<ast.VariableDeclaration>([
          (vd) => isVariableDeclarationList(vd.getParent()),
          (vd) => isVariableStatement(vd.getParent().getParent() as any),
          (vd) =>
            pipe(
              vd.getInitializer(),
              Predicate.every([
                flow(
                  Option.fromNullable,
                  Option.flatMap(
                    Option.liftPredicate(
                      Predicate.not(ast.Node.isFunctionLikeDeclaration)
                    )
                  ),
                  Option.isSome
                ),
                () =>
                  pipe(
                    (vd.getParent().getParent() as ast.VariableStatement).getJsDocs(),
                    shouldNotIgnore
                  ),
                () =>
                  (
                    vd.getParent().getParent() as ast.VariableStatement
                  ).isExported()
              ])
            )
        ])
      )
    )),
  Effect.flatMap((variableDeclarations) =>
    pipe(
      variableDeclarations,
      Effect.validateAll(parseConstantVariableDeclaration)
    )
  )
)

const parseExportSpecifier = (es: ast.ExportSpecifier) =>
  Effect.gen(function*(_) {
    const source = yield* _(Source)
    const name = es.compilerNode.name.text
    const type = stripImportTypes(es.getType().getText(es))
    const ocommentRange = ReadonlyArray.head(es.getLeadingCommentRanges())
    if (Option.isNone(ocommentRange)) {
      return yield* _(
        Effect.fail(
          `Missing ${chalk.bold(name)} documentation in ${chalk.bold(source.path.join("/"))}`
        )
      )
    }
    const commentRange = ocommentRange.value
    const text = commentRange.getText()
    const doc = yield* _(getDoc(name, text))
    const signature = `export declare const ${name}: ${type}`
    return Domain.createExport(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature
    )
  })

const parseExportStar = (
  ed: ast.ExportDeclaration
): Effect.Effect<Source | Config.Config, string, Domain.Export> =>
  Effect.gen(function*(_) {
    const source = yield* _(Source)
    const es = ed.getModuleSpecifier()!
    const name = es.getText()
    const namespace = ed.getNamespaceExport()?.getName()
    const signature = `export *${namespace === undefined ? "" : ` as ${namespace}`} from ${name}`
    const ocommentRange = ReadonlyArray.head(ed.getLeadingCommentRanges())
    if (Option.isNone(ocommentRange)) {
      return yield* _(
        Effect.fail(
          `Missing ${chalk.bold(signature)} documentation in ${chalk.bold(source.path.join("/"))}`
        )
      )
    }
    const commentRange = ocommentRange.value
    const text = commentRange.getText()
    const doc = yield* _(getDoc(name, text))
    return Domain.createExport(
      Domain.createNamedDoc(
        `From ${name}`,
        doc.description.pipe(
          Option.orElse(() =>
            Option.some(
              `Re-exports all named exports from the ${name} module${
                namespace === undefined ? "" : ` as \`${namespace}\``
              }.`
            )
          )
        ),
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category.pipe(Option.orElse(() => Option.some("exports")))
      ),
      signature
    )
  })

const parseNamedExports = (ed: ast.ExportDeclaration) => {
  const namedExports = ed.getNamedExports()
  if (namedExports.length === 0) {
    return parseExportStar(ed).pipe(Effect.mapBoth({
      onFailure: ReadonlyArray.of,
      onSuccess: ReadonlyArray.of
    }))
  }
  return Effect.validateAll(namedExports, parseExportSpecifier)
}

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseExports = pipe(
  Effect.map(Source, (source) => source.sourceFile.getExportDeclarations()),
  Effect.flatMap((exportDeclarations) => Effect.validateAll(exportDeclarations, parseNamedExports)),
  Effect.mapBoth({
    onFailure: ReadonlyArray.flatten,
    onSuccess: ReadonlyArray.flatten
  })
)

const parseModuleDeclaration = (
  ed: ast.ModuleDeclaration
): Effect.Effect<Source | Config.Config, Array<string>, Domain.Namespace> =>
  Effect.flatMap(Source, (_source) => {
    const name = ed.getName()
    const text = getJSDocText(ed.getJsDocs())
    const getInfo = pipe(
      getDoc(name, text),
      Effect.mapError((e) => [e])
    )
    const getInterfaces = parseInterfaces_(ed.getInterfaces())
    const getTypeAliases = parseTypeAliases_(
      ed.getTypeAliases()
    )
    const getNamespaces = parseNamespaces_(ed.getModules())
    return Effect.gen(function*(_) {
      const info = yield* _(getInfo)
      const interfaces = yield* _(getInterfaces)
      const typeAliases = yield* _(getTypeAliases)
      const namespaces = yield* _(getNamespaces)
      return Domain.createNamespace(
        Domain.createNamedDoc(
          name,
          info.description,
          info.since,
          info.deprecated,
          info.examples,
          info.category
        ),
        interfaces,
        typeAliases,
        namespaces
      )
    })
  })

const parseNamespaces_ = (namespaces: ReadonlyArray<ast.ModuleDeclaration>) =>
  pipe(
    namespaces,
    ReadonlyArray.filter(
      Predicate.every<ast.ModuleDeclaration>([
        (module) => module.isExported(),
        (module) => pipe(module.getJsDocs(), shouldNotIgnore)
      ])
    ),
    Effect.validateAll(parseModuleDeclaration),
    Effect.mapBoth({
      onFailure: ReadonlyArray.flatten,
      onSuccess: sortByName
    })
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseNamespaces: Effect.Effect<
  Source | Config.Config,
  Array<string>,
  Array<Domain.Namespace>
> = Effect.flatMap(Source, (source) => parseNamespaces_(source.sourceFile.getModules()))

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
  Effect.gen(function*(_) {
    const name = md.getName()
    const overloads = md.getOverloads()
    const jsdocs = pipe(
      overloads,
      ReadonlyArray.matchLeft({
        onEmpty: () => md.getJsDocs(),
        onNonEmpty: (x) => x.getJsDocs()
      })
    )
    if (shouldIgnore(parseComment(getJSDocText(jsdocs)))) {
      return Option.none()
    }
    const text = getJSDocText(jsdocs)
    const doc = yield* _(getDoc(name, text))
    const signatures = pipe(
      overloads,
      ReadonlyArray.matchRight({
        onEmpty: () => [getMethodSignature(md)],
        onNonEmpty: (init, last) =>
          pipe(
            init.map((md) => md.getText()),
            ReadonlyArray.append(getMethodSignature(last))
          )
      })
    )
    return Option.some(
      Domain.createMethod(
        Domain.createNamedDoc(
          name,
          doc.description,
          doc.since,
          doc.deprecated,
          doc.examples,
          doc.category
        ),
        signatures
      )
    )
  })

const parseProperty = (classname: string) => (pd: ast.PropertyDeclaration) =>
  Effect.gen(function*(_) {
    const name = pd.getName()
    const text = getJSDocText(pd.getJsDocs())
    const doc = yield* _(getDoc(`${classname}#${name}`, text))
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
    return Domain.createProperty(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature
    )
  })

const parseProperties = (name: string, c: ast.ClassDeclaration) =>
  pipe(
    c.getProperties(),
    ReadonlyArray.filter(
      Predicate.every<ast.PropertyDeclaration>([
        (prop) => !prop.isStatic(),
        (prop) =>
          pipe(
            prop.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword),
            Option.fromNullable,
            Option.isNone
          ),
        (prop) => pipe(prop.getJsDocs(), shouldNotIgnore)
      ])
    ),
    (propertyDeclarations) => pipe(propertyDeclarations, Effect.validateAll(parseProperty(name)))
  )

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

const getClassName = (c: ast.ClassDeclaration) =>
  Effect.flatMap(Source, (source) =>
    Effect.mapError(
      Option.fromNullable(c.getName()),
      () => [`Missing ${chalk.bold("class name")} in module ${chalk.bold(source.path.join("/"))}`]
    ))

const getClassDoc = (name: string, c: ast.ClassDeclaration) => {
  const text = getJSDocText(c.getJsDocs())
  return getDoc(name, text).pipe(Effect.mapError(ReadonlyArray.of))
}

const getClassDeclarationSignature = (name: string, c: ast.ClassDeclaration) =>
  pipe(
    Effect.succeed(getTypeParameters(c.getTypeParameters())),
    Effect.map((typeParameters) =>
      pipe(
        c.getConstructors(),
        ReadonlyArray.matchLeft({
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
  Effect.gen(function*(_) {
    const name = yield* _(getClassName(c))
    const doc = yield* _(getClassDoc(name, c))
    const signature = yield* _(getClassDeclarationSignature(name, c))
    const methods = yield* _(pipe(
      c.getInstanceMethods(),
      Effect.validateAll(parseMethod),
      Effect.map(ReadonlyArray.compact)
    ))
    const staticMethods = yield* _(pipe(
      c.getStaticMethods(),
      Effect.validateAll(parseMethod),
      Effect.map(ReadonlyArray.compact)
    ))
    const properties = yield* _(parseProperties(name, c))
    return Domain.createClass(
      Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      ),
      signature,
      methods,
      staticMethods,
      properties
    )
  })

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseClasses = Effect.gen(function*(_) {
  const source = yield* _(Source)
  const classDeclarations = pipe(
    source.sourceFile.getClasses(),
    ReadonlyArray.filter(Predicate.every<ast.ClassDeclaration>([
      (id) => id.isExported(),
      (id) => pipe(id.getJsDocs(), shouldNotIgnore)
    ]))
  )
  return yield* _(pipe(
    classDeclarations,
    Effect.validateAll(parseClass),
    Effect.mapBoth({
      onFailure: ReadonlyArray.flatten,
      onSuccess: sortByName
    })
  ))
})

const getModuleName = (
  path: ReadonlyArray.NonEmptyReadonlyArray<string>
): string => NodePath.parse(ReadonlyArray.lastNonEmpty(path)).name

/**
 * @internal
 */
export const parseModuleDocumentation = Effect.gen(function*(_) {
  const config = yield* _(Config.Config)
  const source = yield* _(Source)
  const name = getModuleName(source.path)
  // if any of the settings enforcing documentation are set to `true`, then
  // a module should have associated documentation
  const isDocumentationRequired = config.enforceDescriptions || config.enforceVersion
  const statements = source.sourceFile.getStatements()
  const ofirstStatement = ReadonlyArray.head(statements)
  if (Option.isNone(ofirstStatement)) {
    if (isDocumentationRequired) {
      return yield* _(
        Effect.fail(
          [`Empty ${chalk.bold(source.path.join("/"))} module`]
        )
      )
    }
  } else {
    const firstStatement = ofirstStatement.value
    const ocommentRange = ReadonlyArray.head(firstStatement.getLeadingCommentRanges())
    if (Option.isNone(ocommentRange)) {
      if (isDocumentationRequired) {
        return yield* _(Effect.fail(
          [`Missing ${chalk.bold("documentation")} in ${chalk.bold(source.path.join("/"))} module`]
        ))
      }
    } else {
      const commentRange = ocommentRange.value
      const text = commentRange.getText()
      const doc = yield* _(
        getDoc("<module fileoverview>", text, true).pipe(Effect.mapError(ReadonlyArray.of))
      )
      return Domain.createNamedDoc(
        name,
        doc.description,
        doc.since,
        doc.deprecated,
        doc.examples,
        doc.category
      )
    }
  }
  return Domain.createNamedDoc(
    name,
    Option.none(),
    Option.none(),
    false,
    [],
    Option.none()
  )
})

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseModule = Effect.gen(function*(_) {
  const source = yield* _(Source)
  const doc = yield* _(parseModuleDocumentation)
  const interfaces = yield* _(parseInterfaces)
  const functions = yield* _(parseFunctions)
  const typeAliases = yield* _(parseTypeAliases)
  const classes = yield* _(parseClasses)
  const constants = yield* _(parseConstants)
  const exports = yield* _(parseExports)
  const namespaces = yield* _(parseNamespaces)
  return Domain.createModule(
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
(
  file: FileSystem.File
): Effect.Effect<Config.Config, Array<string>, Domain.Module> => {
  const path = file.path.split(
    NodePath.sep
  ) as any as ReadonlyArray.NonEmptyReadonlyArray<string>
  const sourceFile = project.getSourceFile(file.path)
  if (sourceFile !== undefined) {
    return pipe(
      parseModule,
      Effect.provideService(Source, { path, sourceFile })
    )
  }
  return Effect.fail([`Unable to locate file: ${file.path}`])
}

const createProject = (files: ReadonlyArray<FileSystem.File>) =>
  Effect.gen(function*(_) {
    const config = yield* _(Config.Config)
    const process = yield* _(Process.Process)
    const cwd = yield* _(process.cwd)
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
 * @since 1.0.0
 */
export const parseFiles = (files: ReadonlyArray<FileSystem.File>) =>
  createProject(files).pipe(
    Effect.flatMap((project) =>
      pipe(
        files,
        Effect.validateAll(parseFile(project)),
        Effect.map(
          flow(
            ReadonlyArray.filter((module) => !module.deprecated),
            sortModulesByPath
          )
        )
      )
    )
  )
