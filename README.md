# VICE COVER — GTA 6-Style Cover Art Maker

Turn your photo and a caption into GTA-style multi-panel cover art, exported
as a PNG to share. 100% offline: static files under `app/`, no network
request, photos never leave your machine.

## What it does

- **Any photo** — upload your own photos, drag & drop, or start from the two
  free sample photos. Each panel takes its own photo.
- **Crop & position per panel** — click a panel to select it, drag it to pan,
  scroll (or use the zoom slider) to zoom, cycle photos, reset.
- **Four poster layouts** — Vice Grid (3 panels), Duo (hero + 2), Quad
  (2 × 2), Hero (full bleed) — with an adjustable panel gap.
- **Caption** — editable title + subtitle, size, top/bottom band, four title
  inks (sunset, gold, neon, plain), heavy outline toggle.
- **Grades & finish** — five colour grades (Vice Sunset, Neon Night, Palm
  Gold, Teal Dusk, Noir) with strength, plus film grain, vignette, and a
  retro sun & palm-silhouette skyline drawn by the app itself.
- **Fast export** — PNG at 1080 × 1080, 1080 × 1350, or 1920 × 1080 in one
  click. Undo/redo (Ctrl+Z / Ctrl+Y) throughout.

## Run it

```sh
# serve app/ with any static server, e.g.:
node serve.mjs        # serves app/ at http://localhost:8080
# or:
python3 -m http.server 8080 --directory app
```

Open `http://localhost:8080` in desktop Chrome. Add a photo, pick a layout
and grade, edit the caption, hit **Export PNG**.

## Hand in (what `main.ts` does)

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to the output directory and writes `dossier.json` with `buildDossier` from
`vendor/makefun-app.ts` (the kit's library, unchanged):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Originality

All lettering, grades, sun, palms, grain and vignette are drawn by this app
on canvas. No Rockstar Games logo, artwork, or font is used anywhere; the
title font is the system heavy sans-serif stack. Sample photos are the kit's
free-to-use samples.

## License

MIT — see `LICENSE`.
