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
- `npm install` - Install all Node.js dependencies (PostCSS, Sass, esbuild, etc.)

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
  - `golhaye-rangarang` (گلهای رنگارنگ) - Main series with 570+ episodes
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
- **Beta**: Uses `config/beta/config.toml`, deployed to beta branch
- **Development**: Uses `config/development/config.toml` for local work

### Content Structure Pattern
Each program markdown file follows this front matter structure:
```yaml
date: "2025-09-09"
program_type: "گلهای-رنگارنگ"
program_number: "۵۷۰"
dastgah: "شور"
singers: ["حمیرا"]
players: ["پرویز یاحقی"]
poets: ["حافظ", "مجمر زواره ای"]
announcers: ["فیروزه امیرمعز"]
```

### Persian Language Features
- RTL text direction support
- Persian number conversion utilities
- Preserves Persian characters in URLs
- Tag aliases system in `data/tag_aliases.yaml` for name normalization

### Deployment
- **Netlify**: Automatic deployment on push to main/beta branches
- **Hugo Version**: Pinned to v0.147.0 in production
- **Build Context**: Different Hugo environments for production, beta, and preview deployments

## Important Notes
- Audio files are NOT stored in this repository - they are hosted separately
- The site is optimized for Persian content with proper RTL support
- Program numbers use Persian digits in content but may use English digits in file names
- Content is organized by radio program series, not by artist or musical style