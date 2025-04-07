#!/bin/bash
# build.sh - Environment-aware build script for golhaprogram

# Default to production if not specified
HUGO_ENV=${HUGO_ENV:-production}

echo "Building site for environment: $HUGO_ENV"

# Run npm build scripts
npm run build:js
npm run build:sass

# Build Hugo with the specified environment
hugo --gc --minify -e $HUGO_ENV

echo "Build complete for $HUGO_ENV environment"
