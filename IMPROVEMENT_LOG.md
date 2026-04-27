# Scholar's Haven Improvement Log

This log tracks the stability, portability, and maintainability improvements made to the Scholar's Haven codebase.

## Current State Audit (2026-04-23)

- **Architecture**: Host-agnostic SPA with Tauri desktop wrapper.
- **Storage**: Unified `StorageAdapter` interface with IndexedDB (Web) and FileSystem (Tauri) implementations.
- **Data**: Modular imported content from the "Study about" folder.
- **UX**: Premium desktop-first aesthetics with serif-sans typography.

## Fixed Issues

### Iteration 1: Stability & Maintenance (2026-04-23)

- [x] Hardened `items-store.ts` by removing hardcoded storage references; now uses the host-agnostic `getActiveStorage()` adapter path.
- [x] Implemented robust Zod validation during store hydration to prevent corrupt state from crashing the app.
- [x] Replaced all primitive `alert()` calls with premium `sonner` toasts for import, export, and destructive actions.
- [x] Fixed missing `Search` icon import in `search.tsx`.
- [x] Added `toast` feedback to item actions (Pin, Archive, Duplicate, Save).
- [x] Improved "Reset Vault" flow with loading states and confirmation feedback.

### Iteration 2: Reliability Hardening (2026-04-26)

- [x] Mounted the global `Toaster` in the app root so existing toast calls are visible to users.
- [x] Added hydration deduplication in `items-store` and `settings-store` to prevent duplicate concurrent initialization work (including duplicate seed writes in dev Strict Mode).
- [x] Normalized lifecycle drift (`status`/`archived`) on Tauri item writes to keep desktop persistence aligned with model invariants.
- [x] Hardened JSON and vault importers with deterministic malformed-JSON errors.
- [x] Added regression tests for hydration deduplication/retry, malformed importer input, and Tauri lifecycle normalization.
- [x] Improved item action error handling in `items.$itemId.tsx` to avoid unhandled async failures.
- [x] Hardened `chart.tsx` by sanitizing chart IDs used in generated style selectors and fixed tooltip rendering for zero values.

## Remaining Technical Debt

- [ ] Implement a centralized error logging/boundary system.
- [ ] Optimize search indexing for very large datasets (currently using array filtering).
- [ ] Add a more robust PDF/asset viewer with zoom/search capabilities.
- [x] Implement "AI-Ready Export" (Zip of human-readable JSON files).
- [x] Add unit tests for storage adapters and validation logic.
- [x] Add import security regression tests for unsafe file IDs, missing files, duplicate IDs, count mismatches, and size mismatches.
- [x] Add Tauri storage recovery tests for temp-file, backup, corrupt primary, and stale-writer handling.

## Platform-Specific Blockers

- **Windows**: Build tools required for Tauri (MSVC).
- **macOS/Linux**: Build environment setup required for native binaries.
