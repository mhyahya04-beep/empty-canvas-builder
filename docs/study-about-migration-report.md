# Study about Migration Report

This report documents the reorganization of the imported `Study about` folder into the canonical project structure.

## Overview

The migration followed a local-first, desktop-friendly strategy, separating original source files, binary assets, and normalized application data.

## Migration Inventory

### 1. Original Files (untouched)

Moved to `content/originals/study-about/`:

- `arabic/Untitled document.docx`
- `computer-science/Resources.docx`
- `geography/Untitled document.docx`
- `perfumes/Untitled document.docx`
- `studying-quran/Notes_ Yahya.docx`
- `theory-studies/Untitled document.docx`
- `islam/[0] Foundation/` (empty folder)
- `islam/[1] Quran/` (empty folder)

### 2. Binary Assets

Moved to `content/assets/study-about/studying-quran/pdfs/`:

- `The Holy Quran - Arabic Text and English Translation.pdf` (18.6 MB)
- `The Holy Qur_an (Abdullah Yusuf Ali).pdf` (239.7 MB)

### 3. Normalized App Data

Created modular TypeScript data files in `src/data/imported/`:

- `quran.ts`: Contains the "Studying Quran" subject, surah notes, and PDF library references.
- `cs.ts`: Contains the "Computer Science" subject and the structured "Learning Resources" list.
- `links.ts`: Contains link collections for Arabic, Perfumes, Theory Studies, and Geography.
- `index.ts`: Unified entry point for all imported content.

## Reconcilation with App Data

- The existing `src/data/seed.ts` was refactored to bootstrap from the new modular files.
- Duplicate data was avoided by reconciling the original `seed.ts` content with the imported files.
- All normalized items now include provenance metadata:
  - `origin.type`: 'migration'
  - `origin.originalFile`: Path to the source file
  - `origin.importedAt`: Timestamp of migration

## Handling of Large Files

- Giant PDFs (e.g., Abdullah Yusuf Ali translation) are kept in `content/assets/` to avoid bundling them into the `src` directory, which would negatively impact build performance and bundle size.
- The app references these as `pdf_library_item` entries with appropriate metadata.

## Future Recommendations

- Any future imported folders should follow the `content/originals/` and `content/normalized/` pattern to maintain a clean separation of concerns.
- Use the `src/data/imported/` directory for modular bootstrap code.
