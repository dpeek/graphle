# Graph Query

`@io/graph-query` owns the shared query runtime above authored module query
surfaces and below route-local UI shells.

It includes the installed query-surface registry, query editor model, saved
query and saved view helpers, query executor registry, query-container runtime,
and route-neutral workbench helpers.

## Entrypoints

- `@io/graph-query`
- `@io/graph-query/react-dom`

## Build

Run `turbo build --filter=@io/graph-query` to emit `./out`.
Run `turbo check --filter=@io/graph-query` to lint, format, type-check, and
run the package-local tests.
