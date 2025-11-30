# 🚀 NASA APOD MCP Server

An MCP (Model Context Protocol) server that provides seamless access to NASA's **Astronomy Picture of the Day** API. Enable your LLM to explore the cosmos through stunning daily astronomy images and rich educational content spanning nearly 30 years of discoveries.

![NASA APOD](https://apod.nasa.gov/apod/image/2411/MeteorMoon_Zar_960.jpg)

## ✨ Features

- **🌟 Today's Picture** - Get the current day's featured astronomy image with scientific explanation
- **📅 Historical Archive** - Browse any APOD since June 16, 1995 (the very first!)
- **📆 Date Ranges** - Explore collections from specific time periods (eclipses, missions, events)
- **🎲 Random Discovery** - Let serendipity guide you through the archive
- **🔍 Smart Search** - Find APODs by topic (black holes, nebulas, Mars, etc.)

## 🛠️ Installation

```bash
# Clone or copy the server
cd nasa-apod-mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server
npm start
```

## 🔧 Configuration

### API Key (Optional but Recommended)

The server uses NASA's `DEMO_KEY` by default, which has rate limits. For production use:

1. Get a free API key at [https://api.nasa.gov](https://api.nasa.gov)
2. Set the environment variable:
   ```bash
   export NASA_API_KEY=your_key_here
   ```

### Transport Options

```bash
# stdio transport (default) - for local integrations
npm start

# HTTP transport - for remote access
TRANSPORT=http npm start

# Custom port for HTTP
TRANSPORT=http PORT=8080 npm start
```

## 🔌 Using with MCP Clients

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "nasa-apod": {
      "command": "node",
      "args": ["/path/to/nasa-apod-mcp-server/dist/index.js"],
      "env": {
        "NASA_API_KEY": "your_key_here"
      }
    }
  }
}
```

### HTTP Client Connection

```typescript
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:3000/mcp")
);
await client.connect(transport);
```

## 📖 Available Tools

### `nasa_apod_today`
Get today's Astronomy Picture of the Day.

```
"What's today's astronomy picture?"
"Show me today's space image"
```

### `nasa_apod_by_date`
Get the APOD for any specific date since 1995-06-16.

```
"What was the APOD on my birthday 2020-05-15?"
"Show me the first ever APOD"
"What was featured on New Year's Day 2000?"
```

### `nasa_apod_range`
Get all APODs within a date range.

```
"Show APODs from the last week"
"What images were posted during the 2024 eclipse?"
"Get all APODs from December 2023"
```

### `nasa_apod_random`
Discover random APODs from the entire archive.

```
"Show me some random space pictures"
"Surprise me with 10 astronomy images"
"I'm feeling lucky - show me something cool from space"
```

### `nasa_apod_search`
Search the archive by keyword (searches titles and explanations).

```
"Find APODs about black holes"
"Search for nebula images from 2023"
"Find Mars rover photos"
"Show me aurora borealis images"
```

## 📊 Response Formats

All tools support two output formats:

- **`markdown`** (default) - Human-readable formatted text
- **`json`** - Structured data for programmatic processing

Example JSON response:
```json
{
  "date": "2024-11-20",
  "title": "The Horsehead Nebula",
  "explanation": "One of the most identifiable nebulae in the sky...",
  "media_type": "image",
  "url": "https://apod.nasa.gov/apod/image/...",
  "hd_url": "https://apod.nasa.gov/apod/image/...",
  "copyright": "Photographer Name"
}
```

## 🏗️ Project Structure

```
nasa-apod-mcp-server/
├── src/
│   ├── index.ts          # Main entry point, server setup
│   ├── types.ts          # TypeScript type definitions
│   ├── constants.ts      # Configuration constants
│   ├── schemas/
│   │   └── apod.ts       # Zod validation schemas
│   ├── services/
│   │   └── nasa-api.ts   # NASA API client
│   └── tools/
│       └── apod.ts       # Tool implementations
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Testing

Test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## 📜 License

MIT

## 🙏 Credits

- [NASA APOD API](https://api.nasa.gov/) - For providing this incredible resource
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - For the protocol implementation

---

*"The cosmos is within us. We are made of star-stuff."* - Carl Sagan
