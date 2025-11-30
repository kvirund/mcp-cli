/**
 * NASA APOD MCP Server - Tool Implementations
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResponseFormat } from "../types.js";
import {
  GetTodayApodSchema,
  GetApodByDateSchema,
  GetApodRangeSchema,
  GetRandomApodsSchema,
  SearchApodsSchema,
  type GetTodayApodInput,
  type GetApodByDateInput,
  type GetApodRangeInput,
  type GetRandomApodsInput,
  type SearchApodsInput
} from "../schemas/apod.js";
import {
  fetchTodayApod,
  fetchApodByDate,
  fetchApodRange,
  fetchRandomApods,
  searchApods,
  transformApodEntry,
  formatApodMarkdown,
  NasaApiError
} from "../services/nasa-api.js";
import { APOD_START_DATE, CHARACTER_LIMIT } from "../constants.js";

/**
 * Format error response with helpful suggestions
 */
function formatError(error: unknown): { isError: true; content: Array<{ type: "text"; text: string }> } {
  if (error instanceof NasaApiError) {
    const message = error.suggestion
      ? `Error: ${error.message}\n\nSuggestion: ${error.suggestion}`
      : `Error: ${error.message}`;
    return {
      isError: true,
      content: [{ type: "text", text: message }]
    };
  }
  
  return {
    isError: true,
    content: [{
      type: "text",
      text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`
    }]
  };
}

/**
 * Truncate text if it exceeds character limit
 */
function truncateIfNeeded(text: string): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }
  return text.slice(0, CHARACTER_LIMIT) + "\n\n... [Response truncated due to length]";
}

/**
 * Register all APOD tools with the MCP server
 */
export function registerApodTools(server: McpServer): void {
  // Tool 1: Get Today's APOD
  server.registerTool(
    "nasa_apod_today",
    {
      title: "Get Today's Astronomy Picture",
      description: `Retrieve today's NASA Astronomy Picture of the Day (APOD).

Returns the daily featured astronomy image or video with its explanation from NASA scientists.

Args:
  - thumbs (boolean): Return thumbnail URL if today's APOD is a video (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format:
  {
    "date": "YYYY-MM-DD",
    "title": "Image title",
    "explanation": "Scientific explanation",
    "media_type": "image" | "video",
    "url": "https://...",
    "hd_url": "https://..." (optional),
    "thumbnail_url": "https://..." (for videos),
    "copyright": "Photographer" (optional)
  }

Examples:
  - "What's today's astronomy picture?" → use nasa_apod_today
  - "Show me today's space image" → use nasa_apod_today`,
      inputSchema: GetTodayApodSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetTodayApodInput) => {
      try {
        const entry = await fetchTodayApod(params.thumbs);
        const output = transformApodEntry(entry);
        
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : formatApodMarkdown(output);
        
        return {
          content: [{ type: "text", text: truncateIfNeeded(text) }],
          structuredContent: output
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // Tool 2: Get APOD by Date
  server.registerTool(
    "nasa_apod_by_date",
    {
      title: "Get APOD by Date",
      description: `Retrieve the Astronomy Picture of the Day for a specific date.

NASA has published an APOD every day since ${APOD_START_DATE}. This tool lets you explore the archive.

Args:
  - date (string): Date in YYYY-MM-DD format (between ${APOD_START_DATE} and today)
  - thumbs (boolean): Return thumbnail URL for video content (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Same structure as nasa_apod_today.

Examples:
  - "What was the APOD on my birthday 2020-05-15?" → nasa_apod_by_date with date="2020-05-15"
  - "Show me the first ever APOD" → nasa_apod_by_date with date="${APOD_START_DATE}"`,
      inputSchema: GetApodByDateSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetApodByDateInput) => {
      try {
        const entry = await fetchApodByDate(params.date, params.thumbs);
        const output = transformApodEntry(entry);
        
        const text = params.response_format === ResponseFormat.JSON
          ? JSON.stringify(output, null, 2)
          : formatApodMarkdown(output);
        
        return {
          content: [{ type: "text", text: truncateIfNeeded(text) }],
          structuredContent: output
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // Tool 3: Get APOD Range
  server.registerTool(
    "nasa_apod_range",
    {
      title: "Get APODs for Date Range",
      description: `Retrieve all Astronomy Pictures of the Day within a date range.

Useful for exploring themes, events, or finding images from a specific time period.

Args:
  - start_date (string): Start date in YYYY-MM-DD format
  - end_date (string): End date in YYYY-MM-DD format
  - thumbs (boolean): Return thumbnail URLs for video content (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format:
  {
    "total": number,
    "count": number,
    "entries": [...ApodOutput],
    "date_range": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }
  }

Examples:
  - "Show APODs from last week" → nasa_apod_range with appropriate dates
  - "What images were posted during the eclipse week?" → nasa_apod_range

Note: Large date ranges may return truncated results.`,
      inputSchema: GetApodRangeSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: GetApodRangeInput) => {
      try {
        const entries = await fetchApodRange(params.start_date, params.end_date, params.thumbs);
        const transformed = entries.map(transformApodEntry);
        
        const output = {
          total: entries.length,
          count: transformed.length,
          entries: transformed,
          date_range: {
            start: params.start_date,
            end: params.end_date
          }
        };
        
        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# APODs from ${params.start_date} to ${params.end_date}\n\n**Found ${entries.length} entries**\n\n---\n\n`;
          const body = transformed.map(formatApodMarkdown).join("\n\n---\n\n");
          text = header + body;
        }
        
        return {
          content: [{ type: "text", text: truncateIfNeeded(text) }],
          structuredContent: output
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // Tool 4: Get Random APODs
  server.registerTool(
    "nasa_apod_random",
    {
      title: "Get Random APODs",
      description: `Retrieve random Astronomy Pictures of the Day from the entire archive.

Perfect for discovery and exploration of NASA's vast collection of astronomy content.

Args:
  - count (number): Number of random entries to return (1-100, default: 5)
  - thumbs (boolean): Return thumbnail URLs for video content (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format:
  {
    "count": number,
    "entries": [...ApodOutput]
  }

Examples:
  - "Show me some random space pictures" → nasa_apod_random
  - "Give me 10 random astronomy images" → nasa_apod_random with count=10
  - "Surprise me with space content" → nasa_apod_random`,
      inputSchema: GetRandomApodsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // Random results differ each time
        openWorldHint: true
      }
    },
    async (params: GetRandomApodsInput) => {
      try {
        const entries = await fetchRandomApods(params.count, params.thumbs);
        const transformed = entries.map(transformApodEntry);
        
        const output = {
          count: transformed.length,
          entries: transformed
        };
        
        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# ${params.count} Random APODs\n\n---\n\n`;
          const body = transformed.map(formatApodMarkdown).join("\n\n---\n\n");
          text = header + body;
        }
        
        return {
          content: [{ type: "text", text: truncateIfNeeded(text) }],
          structuredContent: output
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // Tool 5: Search APODs
  server.registerTool(
    "nasa_apod_search",
    {
      title: "Search APODs",
      description: `Search the APOD archive by keyword.

Searches titles and explanations for matching content. Results are ranked by relevance.

Args:
  - query (string): Search keywords (2-200 characters)
  - start_date (string, optional): Limit search to entries after this date
  - end_date (string, optional): Limit search to entries before this date
  - limit (number): Maximum results to return (1-50, default: 10)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  For JSON format:
  {
    "query": "search terms",
    "total": number,
    "count": number,
    "matches": [...ApodOutput with relevance_score]
  }

Examples:
  - "Find APODs about black holes" → nasa_apod_search with query="black holes"
  - "Search for nebula images from 2023" → nasa_apod_search with query="nebula" and date range
  - "Find Mars rover photos" → nasa_apod_search with query="Mars rover"

Note: Without date range, searches the last year. Large ranges may be slow.`,
      inputSchema: SearchApodsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async (params: SearchApodsInput) => {
      try {
        const matches = await searchApods(
          params.query,
          params.start_date,
          params.end_date,
          params.limit
        );
        
        const output = {
          query: params.query,
          total: matches.length,
          count: matches.length,
          matches
        };
        
        if (matches.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No APODs found matching "${params.query}". Try different keywords or expand the date range.`
            }]
          };
        }
        
        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# Search Results for "${params.query}"\n\n**Found ${matches.length} matches**\n\n---\n\n`;
          const body = matches.map((match, i) => {
            const base = formatApodMarkdown(match);
            return `### ${i + 1}. Relevance Score: ${match.relevance_score}\n\n${base}`;
          }).join("\n\n---\n\n");
          text = header + body;
        }
        
        return {
          content: [{ type: "text", text: truncateIfNeeded(text) }],
          structuredContent: output
        };
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
