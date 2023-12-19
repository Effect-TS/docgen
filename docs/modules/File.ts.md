---
title: File.ts
nav_order: 5
parent: Modules
---

## File overview

Added in v1.0.0

---

<h2 class="text-delta">Table of contents</h2>

- [constructors](#constructors)
  - [createFile](#createfile)
- [layer](#layer)
  - [FileSystemLive](#filesystemlive)
- [model](#model)
  - [File (interface)](#file-interface)
- [service](#service)
  - [FileSystem](#filesystem)
  - [FileSystem (interface)](#filesystem-interface)
- [utils](#utils)
  - [readJsonFile](#readjsonfile)

---

# constructors

## createFile

By default files are readonly (`isOverwriteable = false`).

**Signature**

```ts
export declare const createFile: (path: string, content: string, isOverwriteable?: boolean) => File
```

Added in v1.0.0

# layer

## FileSystemLive

A layer that provides a live implementation of the FileSystem interface using the PlatformFileSystem implementation.

**Signature**

```ts
export declare const FileSystemLive: Layer.Layer<never, never, FileSystem>
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
    readonly isOverwriteable: boolean
  }> {}
```

Added in v1.0.0

# service

## FileSystem

A context tag for the file system module.

**Signature**

```ts
export declare const FileSystem: Context.Tag<FileSystem, FileSystem>
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
  readonly readFile: (path: string) => Effect.Effect<never, Error, string>
  /**
   * Write a file to the specified `path` containing the specified `content`.
   */
  readonly writeFile: (path: string, content: string) => Effect.Effect<never, Error, void>
  /**
   * Removes a file from the file system at the specified `path`.
   */
  readonly removeFile: (path: string) => Effect.Effect<never, Error, void>
  /**
   * Checks if the specified `path` exists on the file system.
   */
  readonly exists: (path: string) => Effect.Effect<never, Error, boolean>
  /**
   * Find all files matching the specified `glob` pattern, optionally excluding
   * files matching the provided `exclude` patterns.
   */
  readonly glob: (pattern: string, exclude?: ReadonlyArray<string>) => Effect.Effect<never, Error, Array<string>>
}
```

Added in v1.0.0

# utils

## readJsonFile

Read a `.json` file from the file system at the specified `path` and parse
the contents.

**Signature**

```ts
export declare const readJsonFile: (path: string) => Effect.Effect<FileSystem, Error, unknown>
```

Added in v1.0.0
