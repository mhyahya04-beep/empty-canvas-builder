Unified Study Vault — Merged product

This scaffold merges leading components from two prior projects into a single unified app.

Design system:
- Desktop-first, academic and structured visual direction (clean, calm, premium)
- Light and dark modes via CSS tokens and a small Tailwind config
- Shared primitives: `AppShell`, `Sidebar`, `Table`, `RichTextEditor`, `RecordDrawer`, `FullScreenDocument`, `Settings`, `Export/Sync`

What's included:
- TanStack Router boot + minimal route tree
- App shell (sidebar + toasts) scaffold
- Rich editor (Tiptap) component
- Dexie-backed DB schema (spaces/fields/records/documents/attachments)

Run locally:

```bash
cd unified-app
npm install
npm run dev
```

Notes:
- Theme tokens live in `src/styles.css` and are wired to Tailwind via `tailwind.config.cjs`.
- Toggle theme from the sidebar; the choice is persisted to `localStorage`.
- Next work: finish storage adapters (Tauri/Drive), remove legacy duplicates, and polish accessibility.
