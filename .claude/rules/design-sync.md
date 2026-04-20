# Design-Code Sync Rules

## `@designDoc` tag

Add a `@designDoc` tag in the file-level JSDoc block of any TypeScript file that implements a formal design document.

**Format:**

```typescript
/**
 * Brief description of this file.
 *
 * @designDoc apps/slaops-docs/internal/platform/design/{subdirectory}/{filename}.md
 */
```

- Path is **monorepo-root-relative** (from the repo root, not the file's own location).
- Multiple tags are allowed when a file spans more than one design doc.
- If the file has no existing file-level JSDoc block, create one.

**Which files get the tag:**

| File type                    | Tag?                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| `.service.ts`                | Yes — always                                                               |
| `.controller.ts`             | Yes — always                                                               |
| Portal hooks `use*.ts`       | Yes — when implementing a designed behaviour                               |
| Portal components `.tsx`     | Yes — when the component is the subject of a UI design doc                 |
| Interface/type files         | Yes — when directly described by a design doc (e.g. `oaspec-documents.ts`) |
| `.module.ts`, DTOs, entities | No                                                                         |
| Generated files, tests       | Never                                                                      |

## When to update a design doc

When editing a file that has a `@designDoc` tag, check whether the change warrants updating the linked design doc(s).

**Update the design doc when the change:**

- Adds or removes a public method, endpoint, or exported interface
- Changes the observable behaviour or contract of an existing feature
- Changes a key implementation decision (algorithm, data format, error handling approach)

**Do NOT update for:**

- Internal refactors with no behaviour change
- Bug fixes that restore originally designed behaviour
- Test additions or import renames

**How to update:**

1. Edit the relevant section(s) of the design doc.
2. Set `updated_at` to today's date in the frontmatter.
3. If `status` is `accepted` and the feature is now fully shipped, set `status: implemented`, `implemented_at: YYYY-MM-DD`, and add the `implemented` tag.

## `implements:` frontmatter (design docs)

When a design doc has a known implementation, add an `implements:` YAML array to its frontmatter listing the primary implementing files (monorepo-root-relative paths):

```yaml
implements:
  - apps/slaops-cloud/src/openapi-indexer/openapi-indexer.service.ts
  - apps/slaops-cloud/src/openapi-indexer/openapi-indexer.controller.ts
```

Docusaurus ignores unknown frontmatter fields — this is safe to add at any time. Add it alongside `implemented_at` when marking a design as `implemented`.
