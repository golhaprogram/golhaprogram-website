[![Netlify Status](https://api.netlify.com/api/v1/badges/b61dbce9-7c5c-470d-965a-cc96398cf91b/deploy-status)](https://app.netlify.com/sites/golhaprogram/deploys)

[![Hugo](https://img.shields.io/badge/Hugo-%23FF4088.svg?style=for-the-badge&logo=hugo&logoColor=white)](https://gohugo.io/)
[![Netlify](https://img.shields.io/badge/Netlify-%23000000.svg?style=for-the-badge&logo=netlify&logoColor=#00C7B7)](https://netlify.com/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-%23F38020.svg?style=for-the-badge&logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![GitHub](https://img.shields.io/badge/GitHub-%23121011.svg?style=for-the-badge&logo=github&logoColor=white)](https://github.com/golhaprogram)
[![DigitalOcean](https://img.shields.io/badge/DigitalOcean-%230167ff.svg?style=for-the-badge&logo=digitalOcean&logoColor=white)](https://www.digitalocean.com/)
[![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Backblaze](https://img.shields.io/badge/Backblaze-%23E21E29.svg?style=for-the-badge&logo=backblaze&logoColor=white)](https://www.backblaze.com/)

# Golha Program Website

This is the source code for [golhaprogram.com](https://golhaprogram.com).

The site is being deloyed via [netlify](https://app.netlify.com/sites/golhaprogram/deploys). The [content](content/programs) directory has all the files in markdown format.

# Hugo

The website is being built via Hugo, these are the files that produce the pages:

```
layouts/
  programs/
    list.html     # Used for /programs/ - lists all program types
                  # (golhaye rangarang, golhaye tazeh, etc)
    
    section.html  # Used for /programs/golhaye-rangarang/ - lists all 
                  # programs within a specific type
    
    single.html   # Used for individual programs like 
                  # /programs/golhaye-rangarang/203

content/
  programs/
    _index.md     # Main programs page content (uses list.html)
    
    golhaye-rangarang/
      _index.md   # Section content (uses section.html)
      203.md      # Individual program (uses single.html)
      100.md      # Individual program (uses single.html)

```

# Setup

To set up the project:


```
npm init -y
npm install -D postcss postcss-cli autoprefixer
```
