# Lumen Gallery

A professional, fully themeable photo and video gallery built with React 19, TypeScript and Vite.
An administrator creates user accounts, uploads media into albums, and controls the look of the
site. Members sign in to browse, like and comment.

## Features

**Administration**
- Admin login with PBKDF2-hashed passwords (Web Crypto, 100k iterations, per-user salt).
- Create, disable, delete users; assign user/admin roles; reset passwords.
- Create albums with title, slug, description, tags, cover image, draft/published state and ordering.
- Drag-and-drop upload of images and videos. Thumbnails are generated client-side (video poster frames too).
- Per-item titles and descriptions, reordering, cover selection.

**Theming**
- Every theme carries a matched light *and* dark palette, display/body fonts, corner radius and density.
- "Roll a theme" generates a harmonious theme (complementary / analogous / triadic / split / monochrome)
  with WCAG-aware text colours. Hand-edit every colour, preview live, then activate site-wide.
- Members pick light, dark or system on their own device. No flash of the wrong mode on load.

**Layouts**
- Six album layouts: Masonry, Grid, Justified, Mosaic, Filmstrip, Carousel.
- Each has columns, gap, caption mode (hover / overlay / below / hidden), tile shape, rounding,
  hover zoom, like badges and an optional hero cover banner.
- A site-wide **default layout** that every album inherits, plus an optional **per-album override**.
  "Roll layout" randomises either. Overrides can be reset individually or all at once.

**Members**
- Browse published albums, open a keyboard-navigable lightbox with video playback.
- Like media, comment on individual items and on albums. Admins can moderate comments.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with the seeded administrator:

| Username | Password |
| -------- | -------- |
| `admin`  | `admin123` |

Change it immediately under **Account → Change password**.

Other scripts:

```bash
npm run build      # type-check and produce dist/
npm run preview    # serve the production build
npm run typecheck  # tsc only
```

## Architecture

```
src/
  db/          Dexie (IndexedDB) schema and shared types
  lib/         auth (hashing/login), media processing, settings, seeding
  store/       Zustand stores: session (persisted login) and UI (colour mode, previews, toasts)
  theme/       colour maths, theme generator ("roll"), CSS-variable applier, presets
  layouts/     layout registry, defaults and the layout generator ("roll")
  components/  shell, theme provider, layouts renderer, lightbox, comments, editors
  pages/       public pages and the admin area
  styles/      a single CSS-variable-driven stylesheet
```

Theming works purely through CSS custom properties set on `<html>` (`--c-*`, `--font-*`,
`--radius`, `--scale`). Any component that uses those variables is automatically themeable.

## Deployment

See [deploy/README.md](deploy/README.md) for the Docker image, the Compose stack with automatic HTTPS,
and the Hostinger VPS deployment workflow.

## Storage model

This is a front-end application. All data, including the uploaded media blobs, lives in the
browser's IndexedDB via Dexie, so it works with no backend and no build-time configuration.
To share galleries between people, point the data layer (`src/db/db.ts` and `src/lib/*`) at an
API or object store; the UI only consumes the Dexie tables through `useLiveQuery`, so the swap
is contained to that layer.
