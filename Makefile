# Golha Program Website Makefile
.PHONY: help dev dev-beta dev-network build build-beta install clean serve-prod lint format troubleshoot

# Default target
help:
	@echo "Available commands:"
	@echo "  make dev         - Start development server (localhost only)"
	@echo "  make dev-beta    - Start development server with beta environment"
	@echo "  make dev-network - Start development server accessible on network"
	@echo "  make build       - Build production site"
	@echo "  make build-beta  - Build site with beta environment"
	@echo "  make install     - Install dependencies"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make serve-prod  - Serve production build locally"
	@echo "  make lint        - Check Hugo configuration"
	@echo "  make format      - Format templates (if available)"
	@echo "  make troubleshoot - Troubleshoot permission issues"

# Development server (localhost only)
dev:
	@echo "Starting Hugo development server via npm..."
	#npm run dev
	hugo server -e development 

# Development server with beta environment
dev-beta:
	@echo "Starting Hugo development server with beta environment..."
	npm run dev:beta

# Development server accessible on network
dev-network:
	hugo server --bind 0.0.0.0 --baseURL http://10.0.10.108:1313 --disableFastRender --noHTTPCache --disableLiveReload

# Build commands
build:
	hugo --gc --minify

build-beta:
	hugo --gc --minify -e beta

# Install dependencies
install:
	npm install

# Clean build artifacts
clean:
	rm -rf public/ resources/

# Serve production build locally (after make build)
serve-prod:
	@if [ ! -d "public" ]; then echo "Run 'make build' first"; exit 1; fi
	cd public && python3 -m http.server 8080

# Check Hugo configuration
lint:
	hugo config
	hugo check

# Format templates (placeholder - add actual formatter if needed)
format:
	@echo "Template formatting not configured"

# Troubleshoot Hugo permission issues
troubleshoot:
	@echo "=== Hugo Troubleshooting ==="
	@echo "Current directory: $(PWD)"
	@echo "User: $(USER)"
	@echo ""
	@echo "Directory permissions:"
	ls -la . | head -5
	@echo ""
	@echo "Hugo version:"
	hugo version || echo "Hugo not found or permission error"
	@echo ""
	@echo "=== Potential solutions ==="
	@echo "1. Try: sudo chown -R $(USER):$(USER) ."
	@echo "2. Try: chmod -R 755 ."
	@echo "3. Try: sudo snap refresh hugo"
	@echo "4. Manual workaround:"
	@echo "   cd /tmp && hugo new site test-site && cd test-site"
	@echo "   Then copy your content, layouts, and config there"

# Quick development setup
setup: install
	@echo "Setup complete! Run 'make troubleshoot' if Hugo server fails"
