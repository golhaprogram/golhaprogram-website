# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
- `npm run dev` - Start Hugo development server at http://localhost:1313
- `npm run dev:beta` - Start development server with beta environment
- `hugo server --bind 0.0.0.0 --baseURL http://10.0.10.108:1313 --disableFastRender --noHTTPCache --disableLiveReload` - Advanced local server with network access

### Build Commands
- `npm run build` - Build production site with minification (`hugo --gc --minify`)
- `npm run build:beta` - Build with beta environment configuration

### Dependencies
- `npm install` - Install Node.js dependencies (only fuse.js, used by search). Sass and JS bundling are done by Hugo Extended itself.

## Architecture Overview

This is a Hugo-based static site for golhaprogram.com, a Persian classical music archive featuring radio programs from Iran. The site uses:

### Core Technologies
- **Hugo Extended v0.139+** - Static site generator with Sass support
- **PaperMod Theme** - Located in `themes/PaperMod/`
- **Persian (RTL) Language** - Default content language with RTL support
- **Netlify Deployment** - Automatic deployment via `netlify.toml`

### Content Architecture
- **Programs**: Each radio program is a markdown file in `content/programs/{series-name}/{episode-number}.md`
- **Series Types**:
  - `golhaye-rangarang` (گل‌های رنگارنگ) - Main series with 570+ episodes
  - `golhaye-tazeh`, `golhaye-javidan`, `yek-shakhe-gol`, `golhaye-sahraee`, `barge-sabz`
- **Audio Files**: Hosted externally at `music.golhaprogram.com` with pattern `{PREFIX}_{NUMBER}.mp3`
- **Metadata**: Rich front matter including singers, poets, players, announcers, dastgah (musical mode)

### URL Structure & Routing
- Programs: `/programs/{series}/{episode-number}/` (e.g., `/programs/golhaye-rangarang/570/`)
- Taxonomies: `/singers/{name}/`, `/poets/{name}/`, `/players/{name}/`, etc.
- Persian characters preserved in URLs (`disablePathToLower = true`)

### Key Layout Templates
- `layouts/programs/single.html` - Individual program pages
- `layouts/programs/section.html` - Series listing pages (e.g., all Golhaye Rangarang)
- `layouts/programs/list.html` - Main programs index

### Critical Partial Templates
- `layouts/partials/audio-url.html` - Generates audio URLs based on program type and number
- `layouts/partials/program-title.html` - Formats Persian program titles consistently
- `layouts/partials/episode-schema.html` - Rich structured data (schema.org) for episodes
- `layouts/partials/program-meta-description.html` - SEO-optimized meta descriptions
- `layouts/partials/seo.html` - SEO tags for OpenGraph, Twitter, and search engines
- `layouts/partials/fa-number.html` - Converts numbers to Persian digits
- `layouts/partials/audio-player.html` - HTML5 audio player integration
- `layouts/partials/comments.html` - Remark42 commenting system

### Audio System
Audio URLs are automatically generated using program metadata:
- `golhaye-rangarang` → `GR_` prefix
- `golhaye-tazeh` → `GT_` prefix
- `golhaye-javidan` → `GJ_` prefix
- `yek-shakhe-gol` → `YSG_` prefix
- `golhaye-sahraee` → `GS_` prefix

### Environment Configuration
- **Production**: Uses `config/production/config.toml`, deployed to golhaprogram.com
- **Beta** (test environment): `config/beta/config.toml`, used by Netlify deploy previews and branch deploys: noindex, comments from `comments-beta.golhaprogram.com`. There is no standalone beta site anymore.
- **Development**: Uses `config/development/config.toml` for local work

### Content Structure Pattern
Each program markdown file follows this front matter structure:
```yaml
date: "2025-09-09"
program_type: "گل‌های-رنگارنگ"
program_number: "۵۷۰"
dastgah: "شور"
singers: ["حمیرا"]
players: ["پرویز یاحقی"]
poets: ["حافظ", "مجمر زواره‌ای"]
announcers: ["فیروزه امیرمعز"]
audio_bytes: 23456789    # added automatically, see below
audio_duration: 1834     # seconds, added automatically
```

`audio_bytes` and `audio_duration` describe the program's MP3 and are filled in by `scripts/audio_metadata.py`, never by hand. On a PR that adds or changes a program, `.github/workflows/audio-metadata.yml` measures the MP3 (HEAD request + ffprobe) and commits the two lines to the PR branch; it fails if a newly added program's MP3 isn't on `music.golhaprogram.com` yet (an edited program only gets a warning). `audio-metadata-backfill.yml` (run by hand) does the same for every program and opens a PR. Both get each program's MP3 URL from `audio-index.json`, built with `hugo -e audioindex` (config/audioindex) from `layouts/partials/audio-url.html`, so the naming rule stays in one place.

### Content checks
`scripts/check_content.py` checks program files; `.github/workflows/content-check.yml` runs it on every PR that adds or changes one. It fixes formatting by itself (trailing spaces in front matter, blank lines in front matter, line endings, final newline) and commits that to the PR. It fails on real problems: invalid front matter; missing `program_type`, `program_number`, `dastgah` or `singers`; a `program_number` that doesn't match the file name (`209B.md` ↔ `۲۰۹ب`, `275C.md` ↔ `۲۷۵ث`); a `program_type` that doesn't match the series folder; unknown fields; and names that are listed twice or have extra spaces. A missing `date` is only a warning. Run it locally with `python3 scripts/check_content.py [--fix] [FILE...]`. Allowed fields are the roles in `data/roles.yaml` plus those listed at the top of the script.

### Air dates (Golha-ye Rangarang)
No archive has broadcast dates, so they are estimated. `data/air_dates.yaml` lists the evidence: programs tied to a datable occasion (`aired`), composition dates (`not_before`), record releases (`released_by`) and when performers joined Golha, each with `basis` (English notes) and `basis_fa` (shown on the site). `scripts/estimate_air_dates.py --write` places the other programs between them in number order on a smooth monotone curve (PCHIP) (B/C parts are separate programs, the following week; at most 5 programs a month), writes `data/air_date_estimates.yaml`, and sets `date_aired: "YYYY-MM"` (Solar Hijri) in each program file. `.github/workflows/air-dates.yml` runs it on PRs that touch the evidence or add Rangarang programs. Program pages show the month with an asterisk linking to `/blog/air-dates/`, which explains the method and renders the chart, evidence table and per-year list from the data files (shortcodes `air-dates-chart`, `air-dates-evidence`, `air-dates-by-year`). To add evidence, edit `data/air_dates.yaml` only.

### Podcast
Each series can have a podcast feed at `/programs/<series>/podcast.xml` (only Golha-ye Rangarang so far): its `_index.md` has `outputs: ["HTML", "Podcast"]` and a `podcast:` block (prefix, title, cover text and colour theme). `layouts/programs/section.podcast.xml` builds a serial show: episodes in number order (`itunes:episode`), dated by the estimated air date (`data/air_date_estimates.yaml`), with `audio_bytes`/`audio_duration` for the enclosure; programs without `audio_bytes` are left out. Owner email and author are in `[params.podcast]`. `/podcast/` (content/podcast.md) tells listeners how to subscribe.

Cover images (one for the show, one per episode) are rendered by `scripts/podcast_art.py` (Chrome via Playwright, Sahel font) and stored on B2 under `music.golhaprogram.com/art/`. `layouts/partials/podcast-art.html` decides what's drawn and names each image with a fingerprint of that text (singers, number, aired month, `artVersion`), so a changed program gets a new image URL and apps refresh it. `.github/workflows/podcast-art.yml` runs on pushes to main and renders and uploads only images not online yet (needs B2 secrets). To redesign every cover, change the script and bump `params.podcast.artVersion`. Old images are not deleted automatically: a few days later, run the workflow by hand on main with `prune: list` to see the images the feed no longer uses, then `prune: delete` to remove them with all their B2 versions (`podcast_art.py --prune [--delete]`; it refuses while any current image is missing from the bucket).

### Persian Language Features
- RTL text direction support
- Persian number conversion utilities
- Preserves Persian characters in URLs
- Tag aliases system in `data/tag_aliases.yaml` for name normalization

### Persian spelling
Text follows the Farhangestan's دستور خط فارسی:
- ZWNJ (nim-fasele), never a space: گل‌ها، می‌رود، نمی‌شود، خانه‌ها، افتاده‌ام، خانه‌ای، بزرگ‌تر.
- Ezafe after a silent ه is «هٔ» (ه + U+0654): برنامهٔ ۵۷۰، گوشهٔ میخانه. Not «ه‌ی».
- Hamza seat by the preceding vowel: تأثیر، مؤثر، سؤال، رئیس، مسئله، جرئت.
- In lyrics, «می» meaning wine stays a separate word (می نوش، می باید خورد), and so do the negative imperatives (میارید، میامیز). Only the verb prefix is joined.
- «ز» (short for «از») before a noun stands apart, like «ز دست»: «ز آتش دل», not «زآتش». Only the merged words are joined, without the madda: «زان»، «زانکه»، «زانچه»، «زین»، «کز»، «وز» (not «زآن» or «ز آن»).
- Renaming a performer changes their taxonomy URL: add a 301 to `static/_redirects`.

`scripts/persian_spelling.py` holds these rules. On every PR that changes content, `.github/workflows/normalize-persian.yml` runs it on the changed files: the unambiguous fixes (Arabic ك/ي/ة and digits, گلها، ه‌ی/ۀ → هٔ، زآتش → ز آتش، زآن → زان، ها/‌اند/نمی with a space, a list of hamza words, double spaces) are committed to the PR; «می» + space and «می» written solid get a warning on the changed line, since only a person can tell the verb prefix from می (wine). Word-level fixes never touch front matter names (that would move a taxonomy page). Run it locally with `python3 scripts/persian_spelling.py [--fix] FILE...`.

### Deployment
- **Netlify**: Production deploys on push to `main`; every PR gets a deploy preview
- **Hugo Version**: Pinned to v0.147.0 in production
- **Build Context**: Different Hugo environments for production, beta, and preview deployments

## Important Notes
- Audio files are NOT stored in this repository - they are hosted separately
- The site is optimized for Persian content with proper RTL support
- Program numbers use Persian digits in content but may use English digits in file names
- Content is organized by radio program series, not by artist or musical style