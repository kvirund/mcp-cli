# MCP CLI

Universal CLI framework with plugin system for MCP (Model Context Protocol) servers.

## Structure

```
packages/
  core/           - Core CLI framework with plugin system
  plugin-browser/ - Browser automation via Chrome DevTools Protocol
  plugin-nasa-apod/     - NASA APOD integration
  plugin-url-downloader/ - URL downloading utilities
```

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Development

```bash
npm run dev
```

## Plugins

The CLI uses a modular plugin architecture. Each plugin extends the core functionality:

- **plugin-browser** - Browser automation using Chrome DevTools Protocol
- **plugin-nasa-apod** - NASA Astronomy Picture of the Day integration
- **plugin-url-downloader** - Download files from URLs
