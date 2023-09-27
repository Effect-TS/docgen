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
  pipe,
  Predicate,
  ReadonlyArray,
  ReadonlyRecord,
  String
} from "effect"
import { flow } from "effect/Function"
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

const every = <A>(predicates: ReadonlyArray<Predicate.Predicate<A>>) => (a: A): boolean =>
  predicates.every((p) => p(a))

const some = <A>(predicates: ReadonlyArray<Predicate.Predicate<A>>) => (a: A): boolean =>
  predicates.some((p) => p(a))

const byName = pipe(
  String.Order,
  Order.mapInput(({ name }: { name: string }) => name)
)

const sortModulesByPath = ReadonlyArray.sort(Domain.ByPath)

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

const shouldIgnore: Predicate.Predicate<Comment> = some([hasInternalTag, hasIgnoreTag])

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

const getMissingError = (
  what: string,
  path: ReadonlyArray<string>,
  name: string
): string =>
  `Missing ${chalk.bold(what)} in ${
    chalk.bold(
      path.join("/") + "#" + name
    )
  } documentation`

const getMissingTagError = (
  tag: string,
  path: ReadonlyArray<string>,
  name: string
): string =>
  `Missing ${chalk.bold(tag)} tag in ${
    chalk.bold(
      path.join("/") + "#" + name
    )
  } documentation`

const getSinceTag = (name: string, comment: Comment) =>
  pipe(
    Effect.all([Config.Config, Source]),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.tags,
        ReadonlyRecord.get("since"),
        Option.flatMap(ReadonlyArray.headNonEmpty),
        Effect.asSome,
        Effect.catchAll(() =>
          config.enforceVersion
            ? Effect.fail(getMissingTagError("@since", source.path, name))
            : Effect.succeed(Option.none<string>())
        )
      )
    )
  )

const getCategoryTag = (name: string, comment: Comment) =>
  Effect.flatMap(Source, (source) =>
    pipe(
      comment.tags,
      ReadonlyRecord.get("category"),
      Option.flatMap(ReadonlyArray.headNonEmpty),
      Effect.asSome,
      Effect.catchAll(() =>
        ReadonlyRecord.has(comment.tags, "category")
          ? Effect.fail(getMissingTagError("@category", source.path, name))
          : Effect.succeed(Option.none<string>())
      )
    ))

const getDescription = (name: string, comment: Comment) =>
  pipe(
    Effect.all([Config.Config, Source]),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.description,
        Option.match({
          onNone: () =>
            config.enforceDescriptions
              ? Effect.fail(getMissingError("description", source.path, name))
              : Effect.succeed(Option.none()),
          onSome: (description) => Effect.succeed(Option.some(description))
        })
      )
    )
  )

const getExamples = (name: string, comment: Comment, isModule: boolean) =>
  pipe(
    Effect.all([Config.Config, Source]),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.tags,
        ReadonlyRecord.get("example"),
        Option.map(ReadonlyArray.compact),
        Option.match({
          onNone: () =>
            config.enforceExamples && !isModule
              ? Effect.fail(getMissingTagError("@example", source.path, name))
              : Effect.succeed([]),
          onSome: (examples) =>
            config.enforceExamples &&
              ReadonlyArray.isEmptyArray(examples) &&
              !isModule
              ? Effect.fail(getMissingTagError("@example", source.path, name))
              : Effect.succeed(examples)
        })
      )
    )
  )

/**
 * @internal
 */
export const getCommentInfo = (name: string, isModule = false) => (text: string) =>
  pipe(
    Effect.Do,
    Effect.let("comment", () => parseComment(text)),
    Effect.bind("since", ({ comment }) => getSinceTag(name, comment)),
    Effect.bind("category", ({ comment }) => getCategoryTag(name, comment)),
    Effect.bind("description", ({ comment }) => getDescription(name, comment)),
    Effect.bind("examples", ({ comment }) => getExamples(name, comment, isModule)),
    Effect.bind("deprecated", ({ comment }) =>
      Effect.succeed(
        pipe(comment.tags, ReadonlyRecord.get("deprecated"), Option.isSome)
      )),
    Effect.map(({ category, deprecated, description, examples, since }) => {
      return Domain.createDoc(
        description,
        since,
        deprecated,
        examples,
        category
      )
    })
  )

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

// -------------------------------------------------------------------------------------
// interfaces
// -------------------------------------------------------------------------------------

const parseInterfaceDeclaration = (id: ast.InterfaceDeclaration) =>
  pipe(
    getJSDocText(id.getJsDocs()),
    getCommentInfo(id.getName()),
    Effect.map((info) =>
      Domain.createInterface(
        Domain.createNamedDoc(
          id.getName(),
          info.description,
          info.since,
          info.deprecated,
          info.examples,
          info.category
        ),
        id.getText()
      )
    )
  )

const parseInterfaces_ = (interfaces: ReadonlyArray<ast.InterfaceDeclaration>) =>
  pipe(
    interfaces,
    ReadonlyArray.filter(
      every<ast.InterfaceDeclaration>([
        (id) => id.isExported(),
        (id) =>
          pipe(
            id.getJsDocs(),
            Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
          )
      ])
    ),
    Effect.validateAll(parseInterfaceDeclaration),
    Effect.map(ReadonlyArray.sort(byName))
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseInterfaces = Effect.flatMap(
  Source,
  (source) => parseInterfaces_(source.sourceFile.getInterfaces())
)

// -------------------------------------------------------------------------------------
// functions
// -------------------------------------------------------------------------------------

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
  pipe(
    Effect.flatMap(Source, (source) =>
      pipe(
        Option.fromNullable(fd.getName()),
        Option.flatMap(Option.liftPredicate((name) => name.length > 0)),
        Effect.mapError(
          () => `Missing function name in module ${source.path.join("/")}`
        )
      )),
    Effect.flatMap((name) =>
      pipe(
        getJSDocText(getFunctionDeclarationJSDocs(fd)),
        getCommentInfo(name),
        Effect.map((info) => {
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
              info.description,
              info.since,
              info.deprecated,
              info.examples,
              info.category
            ),
            signatures
          )
        })
      )
    )
  )

const parseFunctionVariableDeclaration = (vd: ast.VariableDeclaration) => {
  const vs: any = vd.getParent().getParent()
  const name = vd.getName()
  return pipe(
    getJSDocText(vs.getJsDocs()),
    getCommentInfo(name),
    Effect.map((info) => {
      const signature = `export declare const ${name}: ${
        stripImportTypes(
          vd.getType().getText(vd)
        )
      }`
      return Domain.createFunction(
        Domain.createNamedDoc(
          name,
          info.description,
          info.since,
          info.deprecated,
          info.examples,
          info.category
        ),
        [signature]
      )
    })
  )
}

const getFunctionDeclarations = pipe(
  Effect.map(Source, (source) => ({
    functions: pipe(
      source.sourceFile.getFunctions(),
      ReadonlyArray.filter(
        every<ast.FunctionDeclaration>([
          (fd) => fd.isExported(),
          Predicate.not(
            flow(
              getFunctionDeclarationJSDocs,
              getJSDocText,
              parseComment,
              shouldIgnore
            )
          )
        ])
      )
    ),
    arrows: pipe(
      source.sourceFile.getVariableDeclarations(),
      ReadonlyArray.filter(
        every<ast.VariableDeclaration>([
          (vd) => isVariableDeclarationList(vd.getParent()),
          (vd) => isVariableStatement(vd.getParent().getParent() as any),
          (vd) =>
            pipe(
              vd.getInitializer(),
              every([
                flow(
                  Option.fromNullable,
                  Option.flatMap(
                    Option.liftPredicate(ast.Node.isFunctionLikeDeclaration)
                  ),
                  Option.isSome
                ),
                () =>
                  pipe(
                    (
                      vd.getParent().getParent() as ast.VariableStatement
                    ).getJsDocs(),
                    Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
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
export const parseFunctions = pipe(
  Effect.Do,
  Effect.bind("getFunctionDeclarations", () => getFunctionDeclarations),
  Effect.bind("functionDeclarations", ({ getFunctionDeclarations }) =>
    pipe(
      getFunctionDeclarations.functions,
      Effect.validateAll(parseFunctionDeclaration)
    )),
  Effect.bind("variableDeclarations", ({ getFunctionDeclarations }) =>
    pipe(
      getFunctionDeclarations.arrows,
      Effect.validateAll(parseFunctionVariableDeclaration)
    )),
  Effect.map(({ functionDeclarations, variableDeclarations }) =>
    functionDeclarations.concat(variableDeclarations)
  )
)

// -------------------------------------------------------------------------------------
// type aliases
// -------------------------------------------------------------------------------------

const parseTypeAliasDeclaration = (ta: ast.TypeAliasDeclaration) =>
  pipe(
    Effect.succeed(ta.getName()),
    Effect.flatMap((name) =>
      pipe(
        getJSDocText(ta.getJsDocs()),
        getCommentInfo(name),
        Effect.map((info) =>
          Domain.createTypeAlias(
            Domain.createNamedDoc(
              name,
              info.description,
              info.since,
              info.deprecated,
              info.examples,
              info.category
            ),
            ta.getText()
          )
        )
      )
    )
  )

const parseTypeAliases_ = (typeAliases: ReadonlyArray<ast.TypeAliasDeclaration>) =>
  pipe(
    typeAliases,
    ReadonlyArray.filter(
      every<ast.TypeAliasDeclaration>([
        (alias) => alias.isExported(),
        (alias) =>
          pipe(
            alias.getJsDocs(),
            Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
          )
      ])
    ),
    Effect.validateAll(parseTypeAliasDeclaration),
    Effect.map(ReadonlyArray.sort(byName))
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseTypeAliases = Effect.flatMap(
  Source,
  (source) => parseTypeAliases_(source.sourceFile.getTypeAliases())
)

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

const parseConstantVariableDeclaration = (vd: ast.VariableDeclaration) => {
  const vs: any = vd.getParent().getParent()
  const name = vd.getName()
  return pipe(
    getJSDocText(vs.getJsDocs()),
    getCommentInfo(name),
    Effect.map((info) => {
      const type = stripImportTypes(vd.getType().getText(vd))
      const signature = `export declare const ${name}: ${type}`
      return Domain.createConstant(
        Domain.createNamedDoc(
          name,
          info.description,
          info.since,
          info.deprecated,
          info.examples,
          info.category
        ),
        signature
      )
    })
  )
}

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseConstants = pipe(
  Effect.map(Source, (source) =>
    pipe(
      source.sourceFile.getVariableDeclarations(),
      ReadonlyArray.filter(
        every<ast.VariableDeclaration>([
          (vd) => isVariableDeclarationList(vd.getParent()),
          (vd) => isVariableStatement(vd.getParent().getParent() as any),
          (vd) =>
            pipe(
              vd.getInitializer(),
              every([
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
                    (
                      vd.getParent().getParent() as ast.VariableStatement
                    ).getJsDocs(),
                    Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
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

// -------------------------------------------------------------------------------------
// exports
// -------------------------------------------------------------------------------------

const parseExportSpecifier = (es: ast.ExportSpecifier) =>
  Effect.flatMap(Source, (source) =>
    pipe(
      Effect.Do,
      Effect.bind("name", () => Effect.succeed(es.compilerNode.name.text)),
      Effect.bind("type", () => Effect.succeed(stripImportTypes(es.getType().getText(es)))),
      Effect.bind(
        "signature",
        ({ name, type }) => Effect.succeed(`export declare const ${name}: ${type}`)
      ),
      Effect.flatMap(({ name, signature }) =>
        pipe(
          es.getLeadingCommentRanges(),
          ReadonlyArray.head,
          Effect.mapError(
            () => `Missing ${name} documentation in ${source.path.join("/")}`
          ),
          Effect.flatMap((commentRange) => pipe(commentRange.getText(), getCommentInfo(name))),
          Effect.map((info) =>
            Domain.createExport(
              Domain.createNamedDoc(
                name,
                info.description,
                info.since,
                info.deprecated,
                info.examples,
                info.category
              ),
              signature
            )
          )
        )
      )
    ))

const parseExportStar = (
  ed: ast.ExportDeclaration
): Effect.Effect<Source | Config.Config, string, Domain.Export> => {
  const es = ed.getModuleSpecifier()!
  const name = es.getText()
  const signature = `export * from ${name}`
  return Effect.flatMap(Source, (source) => {
    return pipe(
      ed.getLeadingCommentRanges(),
      ReadonlyArray.head,
      Effect.mapError(
        () => `Missing ${signature} documentation in ${source.path.join("/")}`
      ),
      Effect.flatMap((commentRange) => pipe(commentRange.getText(), getCommentInfo(name))),
      Effect.map((info) =>
        Domain.createExport(
          Domain.createNamedDoc(
            `From ${name}`,
            info.description.pipe(Option.orElse(() =>
              Option.some(`Re-exports all named exports from the ${name} module.`)
            )),
            info.since,
            info.deprecated,
            info.examples,
            info.category.pipe(Option.orElse(() =>
              Option.some("exports")
            ))
          ),
          signature
        )
      )
    )
  })
}

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

// -------------------------------------------------------------------------------------
// namespaces
// -------------------------------------------------------------------------------------

const parseModuleDeclaration = (
  ed: ast.ModuleDeclaration
): Effect.Effect<Source | Config.Config, Array<string>, Domain.Namespace> =>
  Effect.flatMap(Source, (_source) => {
    const name = ed.getName()
    const getInfo = pipe(
      getJSDocText(ed.getJsDocs()),
      getCommentInfo(name),
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
      every<ast.ModuleDeclaration>([
        (module) => module.isExported(),
        (module) =>
          pipe(
            module.getJsDocs(),
            Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
          )
      ])
    ),
    Effect.validateAll(parseModuleDeclaration),
    Effect.mapBoth({
      onFailure: ReadonlyArray.flatten,
      onSuccess: ReadonlyArray.sort(byName)
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

// -------------------------------------------------------------------------------------
// classes
// -------------------------------------------------------------------------------------

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
  pipe(
    Effect.Do,
    Effect.bind("name", () => Effect.succeed(md.getName())),
    Effect.bind("overloads", () => Effect.succeed(md.getOverloads())),
    Effect.bind("jsdocs", ({ overloads }) =>
      Effect.succeed(
        pipe(
          overloads,
          ReadonlyArray.matchLeft({
            onEmpty: () => md.getJsDocs(),
            onNonEmpty: (x) => x.getJsDocs()
          })
        )
      )),
    Effect.flatMap(({ jsdocs, name, overloads }) =>
      shouldIgnore(parseComment(getJSDocText(jsdocs)))
        ? Effect.succeed(Option.none())
        : pipe(
          getJSDocText(jsdocs),
          getCommentInfo(name),
          Effect.map((info) => {
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
                  info.description,
                  info.since,
                  info.deprecated,
                  info.examples,
                  info.category
                ),
                signatures
              )
            )
          })
        )
    )
  )

const parseProperty = (classname: string) => (pd: ast.PropertyDeclaration) => {
  const name = pd.getName()
  return pipe(
    getJSDocText(pd.getJsDocs()),
    getCommentInfo(`${classname}#${name}`),
    Effect.map((info) => {
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
          info.description,
          info.since,
          info.deprecated,
          info.examples,
          info.category
        ),
        signature
      )
    })
  )
}

const parseProperties = (name: string, c: ast.ClassDeclaration) =>
  pipe(
    c.getProperties(),
    ReadonlyArray.filter(
      every<ast.PropertyDeclaration>([
        (prop) => !prop.isStatic(),
        (prop) =>
          pipe(
            prop.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword),
            Option.fromNullable,
            Option.isNone
          ),
        (prop) =>
          pipe(
            prop.getJsDocs(),
            Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
          )
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
      () => `Missing class name in module ${source.path.join("/")}`
    ))

const getClassCommentInfo = (name: string, c: ast.ClassDeclaration) =>
  pipe(c.getJsDocs(), getJSDocText, getCommentInfo(name))

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
  pipe(
    Effect.Do,
    Effect.bind("name", () => Effect.mapError(getClassName(c), (e) => [e])),
    Effect.bind("info", ({ name }) => Effect.mapError(getClassCommentInfo(name, c), (e) => [e])),
    Effect.bind("signature", ({ name }) => getClassDeclarationSignature(name, c)),
    Effect.bind("methods", () =>
      pipe(
        c.getInstanceMethods(),
        Effect.validateAll(parseMethod),
        Effect.map(ReadonlyArray.compact)
      )),
    Effect.bind("staticMethods", () =>
      pipe(
        c.getStaticMethods(),
        Effect.validateAll(parseMethod),
        Effect.map(ReadonlyArray.compact)
      )),
    Effect.bind("properties", ({ name }) => parseProperties(name, c)),
    Effect.map(
      ({ info, methods, name, properties, signature, staticMethods }) =>
        Domain.createClass(
          Domain.createNamedDoc(
            name,
            info.description,
            info.since,
            info.deprecated,
            info.examples,
            info.category
          ),
          signature,
          methods,
          staticMethods,
          properties
        )
    )
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseClasses = pipe(
  Effect.map(Source, (source) =>
    pipe(
      source.sourceFile.getClasses(),
      ReadonlyArray.filter(every<ast.ClassDeclaration>([
        (id) => id.isExported(),
        (id) =>
          pipe(
            id.getJsDocs(),
            Predicate.not(flow(getJSDocText, parseComment, shouldIgnore))
          )
      ]))
    )),
  Effect.flatMap((classDeclarations) =>
    pipe(
      classDeclarations,
      Effect.validateAll(parseClass),
      Effect.mapBoth({
        onFailure: ReadonlyArray.flatten,
        onSuccess: ReadonlyArray.sort(byName)
      })
    )
  )
)

// -------------------------------------------------------------------------------------
// modules
// -------------------------------------------------------------------------------------

const getModuleName = (
  path: ReadonlyArray.NonEmptyReadonlyArray<string>
): string => NodePath.parse(ReadonlyArray.lastNonEmpty(path)).name

/**
 * @internal
 */
export const parseModuleDocumentation = pipe(
  Effect.all([Config.Config, Source]),
  Effect.flatMap(([config, source]) => {
    const name = getModuleName(source.path)
    // if any of the settings enforcing documentation are set to `true`, then
    // a module should have associated documentation
    const isDocumentationRequired = config.enforceDescriptions || config.enforceVersion
    const onMissingDocumentation = () =>
      isDocumentationRequired
        ? Effect.fail(
          `Missing documentation in ${source.path.join("/")} module`
        )
        : Effect.succeed(
          Domain.createNamedDoc(
            name,
            Option.none(),
            Option.none(),
            false,
            [],
            Option.none()
          )
        )
    return ReadonlyArray.matchLeft(source.sourceFile.getStatements(), {
      onEmpty: onMissingDocumentation,
      onNonEmpty: (statement) =>
        ReadonlyArray.matchLeft(statement.getLeadingCommentRanges(), {
          onEmpty: onMissingDocumentation,
          onNonEmpty: (commentRange) =>
            pipe(
              getCommentInfo(name, true)(commentRange.getText()),
              Effect.map((info) =>
                Domain.createNamedDoc(
                  name,
                  info.description,
                  info.since,
                  info.deprecated,
                  info.examples,
                  info.category
                )
              )
            )
        })
    })
  })
)

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseModule = pipe(
  Effect.flatMap(Source, (source) =>
    pipe(
      Effect.Do,
      Effect.bind("documentation", () => Effect.mapError(parseModuleDocumentation, (e) => [e])),
      Effect.bind("interfaces", () => parseInterfaces),
      Effect.bind("functions", () => parseFunctions),
      Effect.bind("typeAliases", () => parseTypeAliases),
      Effect.bind("classes", () => parseClasses),
      Effect.bind("constants", () => parseConstants),
      Effect.bind("exports", () => parseExports),
      Effect.bind("namespaces", () => parseNamespaces),
      Effect.map(
        ({
          classes,
          constants,
          documentation,
          exports,
          functions,
          interfaces,
          namespaces,
          typeAliases
        }) =>
          Domain.createModule(
            documentation,
            source.path,
            classes,
            interfaces,
            functions,
            typeAliases,
            constants,
            exports,
            namespaces
          )
      )
    ))
)

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
  pipe(
    Effect.all([Config.Config, Effect.flatMap(Process.Process, (p) => p.cwd)]),
    Effect.map(([config, cwd]) => {
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
  )

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseFiles = (files: ReadonlyArray<FileSystem.File>) =>
  pipe(
    createProject(files),
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
