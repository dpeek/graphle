Project-local guidance for the `io` workspace.

Purpose:

- this repo owns the agent runtime, CLI, shared config surface, and the graph package used to prove the model end to end

Read first:

- `./io/overview.md`
- any docs linked from the issue body
- only then the affected code

Validation:

- `bun check` is required before the change is done
- run focused tests for the packages and config/docs you touch

Local constraints:

- keep changes narrow and reviewable across workspaces
- update docs, examples, and tests together when entrypoint or context behavior changes
- keep repo-local guidance in `io.md` and `io/overview.md`

Output:

- summary of what changed
- validation result
