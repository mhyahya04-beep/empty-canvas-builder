# Security and Storage Invariants

This document captures the invariants that future changes must preserve.

## Attachment File IDs

Stored file IDs are not paths. They are opaque leaf names validated by `src/lib/files/file-id.ts`.

Allowed:

- ASCII letters, numbers, dots, underscores, and hyphens.
- Maximum length: 128 characters.
- Must start with an ASCII letter or number.

Rejected:

- Path separators.
- `..` traversal.
- Absolute paths.
- Encoded traversal lookalikes such as `%2e%2e%2f`.
- Reserved Windows device names such as `CON`, `NUL`, `COM1`, and `LPT1`.
- Leading or trailing whitespace.

The importer validates IDs before mutation. The IndexedDB and Tauri adapters validate again before file operations.

## Vault Import

`.svault` import is a trust boundary.

The importer must reject before modifying storage when:

- `vault.json` is missing.
- The bundle schema is invalid.
- Manifest item/file counts do not match payload counts.
- Attachment IDs are unsafe or duplicated.
- Attachment files are missing.
- Attachment sizes do not match manifest metadata.

Current behavior is replace-by-default for `.svault` imports. UI entry points must require explicit user confirmation before replacement.

## Tauri Storage

The desktop vault file is `vault.json` under the Tauri app data directory.

Writes must preserve these rules:

- Write the new snapshot to `vault.json.tmp`.
- Validate serialized JSON before swapping.
- Preserve the previous valid primary as `vault.json.bak`.
- Rename the temp file over the primary.
- Remove orphan temp files that are not promoted during startup.
- Track a numeric `revision` and refuse stale writes when the on-disk revision changed.

Recovery rules:

- Valid primary: load it.
- Invalid primary with valid backup: restore backup and write a fresh primary.
- Invalid primary without valid backup: preserve the corrupt primary as `vault.corrupt-*.json`, then write an empty vault.
- Valid temp with no primary: promote temp.

## URL Rendering

User-controlled outbound URLs must use HTTP or HTTPS. `javascript:`, `data:`, `file:`, and `blob:` URLs are not valid saved web links.

Seeded PDF asset URLs are restricted to local application assets.

## Chart Styling

Chart CSS variables are generated through a narrow sanitizer. Dynamic chart config may only contribute safe custom-property names and bounded color tokens.

## Verification Checklist

Before merging changes touching import, export, storage, URL rendering, or desktop configuration:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

For Tauri changes, run `cargo check` inside `src-tauri` in an environment with the platform's native build toolchain installed.
