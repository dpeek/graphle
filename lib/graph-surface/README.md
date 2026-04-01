# Graph Surface

`@io/graph-surface` owns route-neutral collection-surface, collection-command,
and record-surface runtime on top of `@io/graph-query`.

The root package resolves authored `CollectionSurfaceSpec` and
`RecordSurfaceSpec` contracts into shared runtime bindings. The `react-dom`
subpath provides the browser mounts for those surfaces.

Record surfaces currently cover the smallest shared detail/runtime slice:

- title and subtitle field binding
- readonly section and field-row rendering
- related collection panels by composing collection-surface mounts
- `ObjectViewSpec` compatibility via explicit adaptation into
  `RecordSurfaceSpec`

Generic command wiring and edit orchestration still stay host-owned.

## Entrypoints

- `@io/graph-surface`
- `@io/graph-surface/react-dom`

## Root API

- `resolveCollectionSurfaceBinding`
- `createCollectionSurfaceSourceResolver`
- `createCollectionSurfaceRuntime`
- `createEntityCollectionCommandSubject`
- `createSelectionCollectionCommandSubject`
- `resolveCollectionCommandBindings`
- `resolveRecordSurfaceBinding`
- `adaptObjectViewToRecordSurface`

## `react-dom` API

- `CollectionSurfaceMount`
- `CollectionSurfaceMountView`
- `CollectionCommandButtons`
- `RecordSurfaceMount`
- `RecordSurfaceMountView`
- `RecordSurfaceLayout`
- `RecordSurfaceSectionView`
