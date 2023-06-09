/**
 * @since 1.0.0
 */
import * as Boolean from "@effect/data/Boolean"
import * as Context from "@effect/data/Context"
import * as Either from "@effect/data/Either"
import { flow, pipe } from "@effect/data/Function"
import * as Option from "@effect/data/Option"
import type { Predicate } from "@effect/data/Predicate"
import { not } from "@effect/data/Predicate"
import * as ReadonlyArray from "@effect/data/ReadonlyArray"
import * as ReadonlyRecord from "@effect/data/ReadonlyRecord"
import * as String from "@effect/data/String"
import * as Order from "@effect/data/typeclass/Order"
import * as Effect from "@effect/io/Effect"
import chalk from "chalk"
import * as doctrine from "doctrine"
import * as NodePath from "node:path"
import * as ast from "ts-morph"
import * as Config from "./Config"
import * as Domain from "./Domain"
import type * as FileSystem from "./FileSystem"

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

interface CommentInfo {
  readonly description: Option.Option<string>
  readonly since: Option.Option<string>
  readonly deprecated: boolean
  readonly examples: ReadonlyArray<Domain.Example>
  readonly category: Option.Option<string>
}

const createCommentInfo = (
  description: Option.Option<string>,
  since: Option.Option<string>,
  deprecated: boolean,
  examples: ReadonlyArray<Domain.Example>,
  category: Option.Option<string>
): CommentInfo => ({
  description,
  since,
  deprecated,
  examples,
  category
})

const every = <A>(predicates: ReadonlyArray<Predicate<A>>) =>
  (a: A): boolean => predicates.every((p) => p(a))

const some = <A>(predicates: ReadonlyArray<Predicate<A>>) =>
  (a: A): boolean => predicates.some((p) => p(a))

const byName = pipe(
  String.Order,
  Order.contramap(({ name }: { name: string }) => name)
)

const sortModules = ReadonlyArray.sort(Domain.Order)

const isNonEmptyString = (s: string) => s.length > 0

/**
 * @internal
 */
export const stripImportTypes = (s: string): string => s.replace(/import\("((?!").)*"\)./g, "")

const getJSDocText: (jsdocs: ReadonlyArray<ast.JSDoc>) => string = ReadonlyArray.matchRight(
  () => "",
  (_, last) => last.getText()
)

const hasTag = (tag: string) =>
  (comment: Comment) => pipe(comment.tags, ReadonlyRecord.get(tag), Option.isSome)

const hasInternalTag = hasTag("internal")

const hasIgnoreTag = hasTag("ignore")

const shouldIgnore: Predicate<Comment> = some([hasInternalTag, hasIgnoreTag])

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
    Effect.all(Config.Config, Source),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.tags,
        ReadonlyRecord.get("since"),
        Option.flatMap(ReadonlyArray.headNonEmpty),
        Option.match(
          () =>
            config.enforceVersion
              ? Either.left(getMissingTagError("@since", source.path, name))
              : Either.right(Option.none()),
          (since) => Either.right(Option.some(since))
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
      Either.liftPredicate(
        not(
          every([
            Option.isNone,
            () => ReadonlyRecord.has(comment.tags, "category")
          ])
        ),
        () => getMissingTagError("@category", source.path, name)
      )
    ))

const getDescription = (name: string, comment: Comment) =>
  pipe(
    Effect.all(Config.Config, Source),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.description,
        Option.match(
          () =>
            config.enforceDescriptions
              ? Either.left(getMissingError("description", source.path, name))
              : Either.right(Option.none()),
          (description) => Either.right(Option.some(description))
        )
      )
    )
  )

const getExamples = (name: string, comment: Comment, isModule: boolean) =>
  pipe(
    Effect.all(Config.Config, Source),
    Effect.flatMap(([config, source]) =>
      pipe(
        comment.tags,
        ReadonlyRecord.get("example"),
        Option.map(ReadonlyArray.compact),
        Option.match(
          () =>
            Boolean.MonoidEvery.combineAll([
                config.enforceExamples,
                !isModule
              ])
              ? Either.left(getMissingTagError("@example", source.path, name))
              : Either.right([]),
          (examples) =>
            Boolean.MonoidEvery.combineAll([
                config.enforceExamples,
                ReadonlyArray.isEmptyArray(examples),
                !isModule
              ])
              ? Either.left(getMissingTagError("@example", source.path, name))
              : Either.right(examples.slice())
        )
      )
    )
  )

/**
 * @internal
 */
export const getCommentInfo = (name: string, isModule = false) =>
  (text: string) =>
    pipe(
      Effect.Do(),
      Effect.bind("comment", () => Either.right(parseComment(text))),
      Effect.bind("since", ({ comment }) => getSinceTag(name, comment)),
      Effect.bind("category", ({ comment }) => getCategoryTag(name, comment)),
      Effect.bind("description", ({ comment }) => getDescription(name, comment)),
      Effect.bind("examples", ({ comment }) => getExamples(name, comment, isModule)),
      Effect.bind("deprecated", ({ comment }) =>
        Either.right(
          pipe(comment.tags, ReadonlyRecord.get("deprecated"), Option.isSome)
        )),
      Effect.map(({ category, deprecated, description, examples, since }) => {
        return createCommentInfo(
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
          Option.filter(isNonEmptyString)
        )
      )
    )
  )
  const description = pipe(
    Option.fromNullable(annotation.description),
    Option.filter(isNonEmptyString)
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
        Domain.createDocumentable(
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

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseInterfaces = pipe(
  Effect.map(Source, (source) =>
    pipe(
      source.sourceFile.getInterfaces(),
      ReadonlyArray.filter(
        every<ast.InterfaceDeclaration>([
          (id) => id.isExported(),
          (id) =>
            pipe(
              id.getJsDocs(),
              not(flow(getJSDocText, parseComment, shouldIgnore))
            )
        ])
      )
    )),
  Effect.flatMap((interfaceDeclarations) =>
    pipe(
      interfaceDeclarations,
      Effect.validateAll(parseInterfaceDeclaration),
      Effect.map(ReadonlyArray.sort(byName))
    )
  )
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
    Option.match(
      () => text.replace("export function ", "export declare function "),
      (body) => {
        const end = body.getStart() - f.getStart() - 1
        return text
          .substring(0, end)
          .replace("export function ", "export declare function ")
      }
    )
  )
}

const getFunctionDeclarationJSDocs = (
  fd: ast.FunctionDeclaration
): Array<ast.JSDoc> =>
  pipe(
    fd.getOverloads(),
    ReadonlyArray.matchLeft(
      () => fd.getJsDocs(),
      (firstOverload) => firstOverload.getJsDocs()
    )
  )

const parseFunctionDeclaration = (fd: ast.FunctionDeclaration) =>
  pipe(
    Effect.flatMap(Source, (source) =>
      pipe(
        Option.fromNullable(fd.getName()),
        Option.flatMap(Option.liftPredicate((name) => name.length > 0)),
        Option.toEither(
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
            ReadonlyArray.matchRight(
              () => [getFunctionDeclarationSignature(fd)],
              (init, last) =>
                pipe(
                  init.map(getFunctionDeclarationSignature),
                  ReadonlyArray.append(getFunctionDeclarationSignature(last))
                )
            )
          )
          return Domain.createFunction(
            Domain.createDocumentable(
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
        Domain.createDocumentable(
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
          not(
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
                    not(flow(getJSDocText, parseComment, shouldIgnore))
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
  Effect.Do(),
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
            Domain.createDocumentable(
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

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseTypeAliases = pipe(
  Effect.map(Source, (source) =>
    pipe(
      source.sourceFile.getTypeAliases(),
      ReadonlyArray.filter(
        every<ast.TypeAliasDeclaration>([
          (alias) => alias.isExported(),
          (alias) =>
            pipe(
              alias.getJsDocs(),
              not(flow(getJSDocText, parseComment, shouldIgnore))
            )
        ])
      )
    )),
  Effect.flatMap((typeAliasDeclarations) =>
    pipe(typeAliasDeclarations, Effect.validateAll(parseTypeAliasDeclaration))
  ),
  Effect.map(ReadonlyArray.sort(byName))
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
        Domain.createDocumentable(
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
                      not(ast.Node.isFunctionLikeDeclaration)
                    )
                  ),
                  Option.isSome
                ),
                () =>
                  pipe(
                    (
                      vd.getParent().getParent() as ast.VariableStatement
                    ).getJsDocs(),
                    not(flow(getJSDocText, parseComment, shouldIgnore))
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
      Effect.Do(),
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
          Option.toEither(
            () => `Missing ${name} documentation in ${source.path.join("/")}`
          ),
          Effect.flatMap((commentRange) => pipe(commentRange.getText(), getCommentInfo(name))),
          Effect.map((info) =>
            Domain.createExport(
              Domain.createDocumentable(
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

const parseExportDeclaration = (ed: ast.ExportDeclaration) =>
  pipe(ed.getNamedExports(), Effect.validateAll(parseExportSpecifier))

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseExports = pipe(
  Effect.map(Source, (source) => source.sourceFile.getExportDeclarations()),
  Effect.flatMap((exportDeclarations) =>
    pipe(exportDeclarations, Effect.validateAll(parseExportDeclaration))
  ),
  Effect.mapBoth(ReadonlyArray.flatten, ReadonlyArray.flatten)
)

// -------------------------------------------------------------------------------------
// classes
// -------------------------------------------------------------------------------------

const getTypeParameters = (
  tps: ReadonlyArray<ast.TypeParameterDeclaration>
): string => tps.length === 0 ? "" : `<${tps.map((p) => p.getName()).join(", ")}>`

const getMethodSignature = (md: ast.MethodDeclaration): string =>
  pipe(
    Option.fromNullable(md.compilerNode.body),
    Option.match(
      () => md.getText(),
      (body) => {
        const end = body.getStart() - md.getStart() - 1
        return md.getText().substring(0, end)
      }
    )
  )

const parseMethod = (md: ast.MethodDeclaration) =>
  pipe(
    Effect.Do(),
    Effect.bind("name", () => Effect.succeed(md.getName())),
    Effect.bind("overloads", () => Effect.succeed(md.getOverloads())),
    Effect.bind("jsdocs", ({ overloads }) =>
      Effect.succeed(
        pipe(
          overloads,
          ReadonlyArray.matchLeft(
            () => md.getJsDocs(),
            (x) => x.getJsDocs()
          )
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
              ReadonlyArray.matchRight(
                () => [getMethodSignature(md)],
                (init, last) =>
                  pipe(
                    init.map((md) => md.getText()),
                    ReadonlyArray.append(getMethodSignature(last))
                  )
              )
            )
            return Option.some(
              Domain.createMethod(
                Domain.createDocumentable(
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

const parseProperty = (classname: string) =>
  (pd: ast.PropertyDeclaration) => {
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
          Option.match(
            () => "",
            () => "readonly "
          )
        )
        const signature = `${readonly}${name}: ${type}`
        return Domain.createProperty(
          Domain.createDocumentable(
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
            not(flow(getJSDocText, parseComment, shouldIgnore))
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
    Option.match(
      () => c.getText(),
      (body) => {
        const end = body.getStart() - c.getStart() - 1
        return c.getText().substring(0, end)
      }
    )
  )

const getClassName = (c: ast.ClassDeclaration) =>
  Effect.flatMap(Source, (source) =>
    pipe(
      Option.fromNullable(c.getName()),
      Option.toEither(
        () => `Missing class name in module ${source.path.join("/")}`
      )
    ))

const getClassCommentInfo = (name: string, c: ast.ClassDeclaration) =>
  pipe(c.getJsDocs(), getJSDocText, getCommentInfo(name))

const getClassDeclarationSignature = (name: string, c: ast.ClassDeclaration) =>
  pipe(
    Effect.succeed(getTypeParameters(c.getTypeParameters())),
    Effect.map((typeParameters) =>
      pipe(
        c.getConstructors(),
        ReadonlyArray.matchLeft(
          () => `export declare class ${name}${typeParameters}`,
          (head) =>
            `export declare class ${name}${typeParameters} { ${
              getConstructorDeclarationSignature(
                head
              )
            } }`
        )
      )
    )
  )

const parseClass = (c: ast.ClassDeclaration) =>
  pipe(
    Effect.Do(),
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
          Domain.createDocumentable(
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
            not(flow(getJSDocText, parseComment, shouldIgnore))
          )
      ]))
    )),
  Effect.flatMap((classDeclarations) =>
    pipe(
      classDeclarations,
      Effect.validateAll(parseClass),
      Effect.mapBoth(ReadonlyArray.flatten, ReadonlyArray.sort(byName))
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
  Effect.all(Config.Config, Source),
  Effect.flatMap(([config, source]) => {
    const name = getModuleName(source.path)
    // if any of the settings enforcing documentation are set to `true`, then
    // a module should have associated documentation
    const isDocumentationRequired = Boolean.MonoidSome.combineAll([
      config.enforceDescriptions,
      config.enforceVersion
    ])
    const onMissingDocumentation = () =>
      isDocumentationRequired
        ? Either.left(
          `Missing documentation in ${source.path.join("/")} module`
        )
        : Either.right(
          Domain.createDocumentable(
            name,
            Option.none(),
            Option.none(),
            false,
            [],
            Option.none()
          )
        )
    return pipe(
      source.sourceFile.getStatements(),
      ReadonlyArray.matchLeft(onMissingDocumentation, (statement) =>
        pipe(
          statement.getLeadingCommentRanges(),
          ReadonlyArray.matchLeft(onMissingDocumentation, (commentRange) =>
            pipe(
              getCommentInfo(name, true)(commentRange.getText()),
              Effect.map((info) =>
                Domain.createDocumentable(
                  name,
                  info.description,
                  info.since,
                  info.deprecated,
                  info.examples,
                  info.category
                )
              )
            ))
        ))
    )
  })
)

/**
 * @category parsers
 * @since 1.0.0
 */
export const parseModule = pipe(
  Effect.flatMap(Source, (source) =>
    pipe(
      Effect.Do(),
      Effect.bind("documentation", () => Effect.mapError(parseModuleDocumentation, (e) => [e])),
      Effect.bind("interfaces", () => parseInterfaces),
      Effect.bind("functions", () => parseFunctions),
      Effect.bind("typeAliases", () => parseTypeAliases),
      Effect.bind("classes", () => parseClasses),
      Effect.bind("constants", () => parseConstants),
      Effect.bind("exports", () => parseExports),
      Effect.map(
        ({
          classes,
          constants,
          documentation,
          exports,
          functions,
          interfaces,
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
            exports
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
    return Either.left([`Unable to locate file: ${file.path}`])
  }

const createProject = (files: ReadonlyArray<FileSystem.File>) =>
  pipe(
    Config.Config,
    Effect.map((config) => {
      const options: ast.ProjectOptions = {
        compilerOptions: {
          strict: true,
          ...config.parseCompilerOptions
        }
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
            sortModules
          )
        )
      )
    )
  )
