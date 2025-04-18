# Golha Program Website

[![Hugo](https://img.shields.io/badge/Hugo-v0.139-ff4088?style=flat&logo=hugo&logoColor=white)](https://gohugo.io/)
[![Netlify Status](https://api.netlify.com/api/v1/badges/45546953-eb4c-4e37-9a72-ecaf2f938b8c/deploy-status)](https://app.netlify.com/sites/golhaprogram/deploys)
[![License: CC BY-SA 4.0](https://img.shields.io/badge/License-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/deed.fa)
[![remark42](https://img.shields.io/badge/Remark42-darkgreen)](https://remark42.com)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-%23F38020.svg?style=flat&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![GitHub](https://img.shields.io/badge/GitHub-%23121011.svg?style=flat&logo=github&logoColor=white)](https://github.com/golhaprogram)
[![DigitalOcean](https://img.shields.io/badge/DigitalOcean-%230167ff.svg?style=flat&logo=digitalOcean&logoColor=white)](https://www.digitalocean.com/)
[![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Backblaze](https://img.shields.io/badge/Backblaze-%23E21E29.svg?style=flat&logo=backblaze&logoColor=white)](https://www.backblaze.com/)

<!--
https://img.shields.io/badge/LEFT-RIGHT-COLOR

![](https://img.shields.io/badge/Hugo%20version-v0.42-ff69b4.svg)
[![Hugo](https://img.shields.io/badge/Hugo-%23FF4088.svg?style=for-the-badge&logo=hugo&logoColor=white)](https://gohugo.io/)
[![Netlify](https://img.shields.io/badge/Netlify-%23000000.svg?style=for-the-badge&logo=netlify&logoColor=#00C7B7)](https://netlify.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-%23F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![GitHub](https://img.shields.io/badge/GitHub-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/golhaprogram)
[![DigitalOcean](https://img.shields.io/badge/DigitalOcean-%230167ff.svg?style=for-the-badge&logo=digitalOcean&logoColor=white)](https://www.digitalocean.com/)
[![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Backblaze](https://img.shields.io/badge/Backblaze-%23E21E29.svg?style=for-the-badge&logo=backblaze&logoColor=white)](https://www.backblaze.com/)
-->

This is the source code for [golhaprogram.com](https://golhaprogram.com).

The site is being deloyed via [netlify](https://app.netlify.com/sites/golhaprogram/deploys).
The [content](content/programs) directory has all the files in markdown format.

## Architecture

- **Static Site Generator**: [Hugo](https://gohugo.io/)
  generates the site from markdown content
- **Hosting**: Deployed via [Netlify](https://www.netlify.com/)
- **Media Storage**: Audio files hosted on [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html)
  at music.golhaprogram.com
- **Comments**: [Remark42](https://remark42.com/) self-hosted on DigitalOcean
- **CDN**: [Cloudflare](https://www.cloudflare.com/) for CDN and DNS management

## Local Development

### Prerequisites

- [Hugo Extended](https://gohugo.io/installation/) (version 0.139.2 or higher)
- Node.js (version 20 or higher)
- npm (version 10 or higher)

### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/golhaprogram/golhaprogram-website.git
   cd golhaprogram-website
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Visit <http://localhost:1313> to see your local development version.

To run the server locally:

```bash
hugo server --bind 0.0.0.0 --baseURL http://10.0.10.108:1313 --disableFastRender
--noHTTPCache --disableLiveReload
```

### Build

To build the production version:

```bash
npm run build
```

This will compile the SCSS, bundle JavaScript, and build the Hugo site.

## Content Structure

- **Programs**: Located in `content/programs/` with subdirectories for
  each program series
- **Pages**: General pages are in `content/`
- **Layouts**: Templates in `layouts/`
- **Assets**: SCSS and JS in `assets/`

## Important Partials

- `layouts/partials/audio-url.html`: Generates audio URLs based on program metadata
- `layouts/partials/program-title.html`: Formats program titles consistently
- `layouts/partials/comments.html`: Integrates Remark42 comments
- `layouts/partials/fa-number.html`: Converts numbers to Persian digits

```text
layouts/
programs/
list.html # Used for /programs/ - lists all program types
          # (golhaye rangarang, golhaye tazeh, etc)

    section.html  # Used for /programs/golhaye-rangarang/ - lists all
                  # programs within a specific type

    single.html   # Used for individual programs like
                  # /programs/golhaye-rangarang/203

content/
programs/
\_index.md # Main programs page content (uses list.html)

    golhaye-rangarang/
      _index.md   # Section content (uses section.html)
      203.md      # Individual program (uses single.html)
      100.md      # Individual program (uses single.html)

```

## Deployment

The site automatically deploys when changes are pushed to the main branch.
The deployment configuration is in `netlify.toml`.

## Audio Files

Audio files follow the naming convention: `{PREFIX}_{NUMBER}.mp3` where:

- `PREFIX` is the program type code (GR, GT, GJ, YSG, GS)
- `NUMBER` is the program number
