---
title: FileSystem.ts
nav_order: 6
parent: Modules
---

## FileSystem overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [GlobError](#globerror)
  - [ParseJsonError](#parsejsonerror)
  - [ReadFileError](#readfileerror)
  - [RemoveFileError](#removefileerror)
  - [WriteFileError](#writefileerror)
  - [makeFile](#makefile)
- [layer](#layer)
  - [FileSystemLive](#filesystemlive)
- [model](#model)
  - [File (interface)](#file-interface)
  - [FileSystem (interface)](#filesystem-interface)
  - [GlobError (interface)](#globerror-interface)
  - [ParseJsonError (interface)](#parsejsonerror-interface)
  - [ReadFileError (interface)](#readfileerror-interface)
  - [RemoveFileError (interface)](#removefileerror-interface)
  - [WriteFileError (interface)](#writefileerror-interface)
- [service](#service)
  - [FileSystem](#filesystem)

---

# constructors

## GlobError

**Signature**

```ts
export declare const GlobError: Data.Case.Constructor<GlobError, '_tag'>
```

Added in v1.0.0

## ParseJsonError

**Signature**

```ts
export declare const ParseJsonError: Data.Case.Constructor<ParseJsonError, '_tag'>
```

Added in v1.0.0

## ReadFileError

**Signature**

```ts
export declare const ReadFileError: Data.Case.Constructor<ReadFileError, '_tag'>
```

Added in v1.0.0

## RemoveFileError

**Signature**

```ts
export declare const RemoveFileError: Data.Case.Constructor<RemoveFileError, '_tag'>
```

Added in v1.0.0

## WriteFileError

**Signature**

```ts
export declare const WriteFileError: Data.Case.Constructor<WriteFileError, '_tag'>
```

Added in v1.0.0

## makeFile

By default files are readonly (`overwrite = false`).

**Signature**

```ts
export declare const makeFile: (path: string, content: string, overwrite?: boolean) => File
```

Added in v1.0.0

# layer

## FileSystemLive

**Signature**

```ts
export declare const FileSystemLive: Layer.Layer<PlatformFileSystem.FileSystem, never, FileSystem>
```

Added in v1.0.0

# model

## File (interface)

Represents a file which can be optionally overwriteable.

**Signature**

```ts
export interface File
  extends Data.Data<{
    readonly path: string
    readonly content: string
    readonly overwrite: boolean
  }> {}
```

Added in v1.0.0

## FileSystem (interface)

Represents a file system which can be read from and written to.

**Signature**

```ts
export interface FileSystem {
  /**
   * Read a file from the file system at the specified `path`.
   */
  readFile(path: string): Effect.Effect<never, ReadFileError, string>
  /**
   * Read a `.json` file from the file system at the specified `path` and parse
   * the contents.
   */
  readJsonFile(path: string): Effect.Effect<never, ReadFileError | ParseJsonError, unknown>
  /**
   * Write a file to the specified `path` containing the specified `content`.
   */
  writeFile(path: string, content: string): Effect.Effect<never, WriteFileError, void>
  /**
   * Removes a file from the file system at the specified `path`.
   */
  removeFile(path: string): Effect.Effect<never, RemoveFileError, void>
  /**
   * Checks if the specified `path` exists on the file system.
   */
  pathExists(path: string): Effect.Effect<never, ReadFileError, boolean>
  /**
   * Find all files matching the specified `glob` pattern, optionally excluding
   * files matching the provided `exclude` patterns.
   */
  glob(pattern: string, exclude?: ReadonlyArray<string>): Effect.Effect<never, GlobError, ReadonlyArray<string>>
}
```

Added in v1.0.0

## GlobError (interface)

Represents an error that occurs when attempting to execute a glob pattern to
find multiple files on the file system.

**Signature**

```ts
export interface GlobError extends Data.Case {
  readonly _tag: 'GlobError'
  readonly pattern: string
  readonly exclude: ReadonlyArray<string>
  readonly error: Error
}
```

Added in v1.0.0

## ParseJsonError (interface)

Represents an error that occurs when attempting to parse JSON content.

**Signature**

```ts
export interface ParseJsonError extends Data.Case {
  readonly _tag: 'ParseJsonError'
  readonly content: string
  readonly error: Error
}
```

Added in v1.0.0

## ReadFileError (interface)

Represents an error that occurs when attempting to read a file from the
file system.

**Signature**

```ts
export interface ReadFileError extends Data.Case {
  readonly _tag: 'ReadFileError'
  readonly path: string
  readonly error: Error
}
```

Added in v1.0.0

## RemoveFileError (interface)

Represents an error that occurs when attempting to remove a file from the
file system.

**Signature**

```ts
export interface RemoveFileError extends Data.Case {
  readonly _tag: 'RemoveFileError'
  readonly path: string
  readonly error: Error
}
```

Added in v1.0.0

## WriteFileError (interface)

Represents an error that occurs when attempting to write a file to the
file system.

**Signature**

```ts
export interface WriteFileError extends Data.Case {
  readonly _tag: 'WriteFileError'
  readonly path: string
  readonly error: Error
}
```

Added in v1.0.0

# service

## FileSystem

**Signature**

```ts
export declare const FileSystem: Context.Tag<FileSystem, FileSystem>
```

Added in v1.0.0
