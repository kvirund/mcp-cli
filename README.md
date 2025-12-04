# MCP CLI

Universal CLI framework with plugin system for MCP (Model Context Protocol) servers.

## Installation

```bash
# Install CLI (includes proxy plugin)
npm install -g @kvirund/mcp-cli

# Install additional plugins
npm install -g @kvirund/mcp-cli-plugin-browser
npm install -g @kvirund/mcp-cli-plugin-nasa-apod
npm install -g @kvirund/mcp-cli-plugin-url-downloader
```

## Structure

```
packages/
  core/                  - Core CLI framework with plugin system
  plugin-browser/        - Browser automation via Chrome DevTools Protocol
  plugin-proxy/          - Proxy plugin for connecting external MCP servers
  plugin-nasa-apod/      - NASA APOD integration
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
| `tools [action] [plugin] [tool]` | `tool` | Manage plugin tools (list, enable, disable) |
| `logs [count\|clear]` | `log` | View MCP tool call logs |
| `serve [port]` | `mcp` | Start MCP SSE server |
| `stop` | | Stop MCP SSE server |
| `clear` | `cls` | Clear screen |
| `exit` | `quit`, `q` | Exit CLI |

## MCP Server

MCP SSE server can be started with `serve` command. Default port is 3000.

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
  "plugins": {
    "browser": {
      "package": "@kvirund/mcp-cli-plugin-browser"
    },
    "nasa": {
      "package": "@kvirund/mcp-cli-plugin-nasa-apod",
      "config": {
        "apiKey": "your-nasa-api-key"
      }
    },
    "filesystem": {
      "package": "@kvirund/mcp-cli-plugin-proxy",
      "config": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
        "autoConnect": true
      },
      "disabledTools": ["write_file"]
    }
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `mcp.port` | `3000` | Default port for MCP SSE server |
| `plugins` | `{}` | Dictionary of plugins (key = plugin name) |

### Plugin Entry Format

| Field | Required | Description |
|-------|----------|-------------|
| `package` | Yes | npm package name to load |
| `config` | No | Plugin-specific configuration |
| `disabledTools` | No | List of tool names to disable |

## Plugins

Modular plugin architecture. Each plugin can provide commands and MCP tools.

### Available Plugins

- **@kvirund/mcp-cli-plugin-browser** - Browser automation via Chrome DevTools Protocol
- **@kvirund/mcp-cli-plugin-proxy** - Connect external MCP servers (stdio/SSE)
- **@kvirund/mcp-cli-plugin-nasa-apod** - NASA Astronomy Picture of the Day
- **@kvirund/mcp-cli-plugin-url-downloader** - HTTP client for fetching URLs

### Proxy Plugin

The proxy plugin allows connecting to external MCP servers and exposing their tools:

```json
{
  "plugins": {
    "github": {
      "package": "@kvirund/mcp-cli-plugin-proxy",
      "config": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "..." },
        "autoConnect": true
      }
    },
    "remote-server": {
      "package": "@kvirund/mcp-cli-plugin-proxy",
      "config": {
        "url": "http://localhost:4000/sse"
      }
    }
  }
}
```

Proxy plugin commands:
- `connect` - Connect to MCP server
- `disconnect` - Disconnect from server
- `restart` - Restart connection
- `status` - Show connection status and tools

## Tool Management

Individual plugin tools can be disabled without disabling the entire plugin:

```bash
# List all tools
tools list

# List tools for specific plugin
tools list browser

# Disable a tool
tools disable browser screenshot

# Enable a tool
tools enable browser screenshot
```

## Tool Call Logging

View history of MCP tool invocations:

```bash
# Show last 20 log entries
logs

# Show last 50 entries
logs 50

# Clear log history
logs clear
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## License

MIT
