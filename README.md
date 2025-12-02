# MCP CLI

Universal CLI framework with plugin system for MCP (Model Context Protocol) servers.

## Installation

```bash
npm install -g @kvirund/mcp-cli
```

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

## Usage

### Interactive Mode

```bash
# Start interactive CLI
mcp-cli

# With specific plugins
mcp-cli -p @kvirund/mcp-cli-plugin-browser
```

### Server Mode

```bash
# Start as stdio server (for Claude Desktop, etc.)
mcp-cli serve

# Start as SSE server
mcp-cli serve --mode sse --port 3000
```

## Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `help [topic]` | `?`, `h` | Show help for commands or plugins |
| `plugins [action] [name]` | `plugin`, `pl` | Manage plugins (list, enable, disable) |
| `serve [port]` | `mcp` | Start MCP SSE server |
| `stop` | | Stop MCP SSE server |
| `clear` | `cls` | Clear screen |
| `exit` | `quit`, `q` | Exit CLI |

## MCP Server

MCP SSE server starts automatically on port 3000 (configurable) when CLI launches. Use `serve <port>` to restart on a different port.

Endpoints:
- SSE: `http://localhost:3000/sse`
- Health: `http://localhost:3000/health`

## Configuration

Config file: `~/.mcp-cli/config.json`

```json
{
  "mcp": {
    "port": 3000
  },
  "plugins": [
    "@kvirund/mcp-cli-plugin-browser",
    {
      "name": "@kvirund/mcp-cli-plugin-nasa-apod",
      "config": {
        "apiKey": "your-nasa-api-key"
      }
    }
  ]
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `mcp.port` | `3000` | Default port for MCP SSE server |
| `plugins` | `[]` | List of plugins to load |

## Plugins

Modular plugin architecture. Each plugin extends core functionality:

- **@kvirund/mcp-cli-plugin-browser** - Browser automation via Chrome DevTools Protocol
- **@kvirund/mcp-cli-plugin-nasa-apod** - NASA Astronomy Picture of the Day
- **@kvirund/mcp-cli-plugin-url-downloader** - HTTP client for fetching URLs

## License

MIT
