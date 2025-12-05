/**
 * MCP tools for NASA APOD plugin
 */

import type { PluginMcpTool } from '@kvirund/mcp-cli/plugin';
import { ResponseFormat } from './types.js';
import { APOD_START_DATE, CHARACTER_LIMIT, MAX_ENTRIES, DEFAULT_RANDOM_COUNT } from './constants.js';
import {
  fetchTodayApod,
  fetchApodByDate,
  fetchApodRange,
  fetchRandomApods,
  searchApods,
  transformApodEntry,
  formatApodMarkdown,
  NasaApiError,
} from './nasa-api.js';

function formatError(error: unknown): string {
  if (error instanceof NasaApiError) {
    return error.suggestion
      ? `Error: ${error.message}\n\nSuggestion: ${error.suggestion}`
      : `Error: ${error.message}`;
  }
  return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
}

function truncateIfNeeded(text: string): string {
  if (text.length <= CHARACTER_LIMIT) {
    return text;
  }
  return text.slice(0, CHARACTER_LIMIT) + '\n\n... [Response truncated due to length]';
}

export const nasaApodMcpTools: PluginMcpTool[] = [
  {
    type: 'tool',
    name: 'apod_today',
    description: `Get today's NASA Astronomy Picture of the Day. Returns the daily featured astronomy image or video with its explanation.`,
    inputSchema: {
      type: 'object',
      properties: {
        thumbs: {
          type: 'boolean',
          description: 'Return thumbnail URL if today\'s APOD is a video (default: false)',
        },
        response_format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
    },
    async handler(params: Record<string, unknown>) {
      try {
        const thumbs = (params.thumbs as boolean) || false;
        const format = (params.response_format as string) || 'markdown';

        const entry = await fetchTodayApod(thumbs);
        const output = transformApodEntry(entry);

        const text =
          format === ResponseFormat.JSON
            ? JSON.stringify(output, null, 2)
            : formatApodMarkdown(output);

        return truncateIfNeeded(text);
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    type: 'tool',
    name: 'apod_by_date',
    description: `Get the Astronomy Picture of the Day for a specific date. NASA has published an APOD every day since ${APOD_START_DATE}.`,
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: `Date in YYYY-MM-DD format (between ${APOD_START_DATE} and today)`,
        },
        thumbs: {
          type: 'boolean',
          description: 'Return thumbnail URL for video content (default: false)',
        },
        response_format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
      required: ['date'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const date = params.date as string;
        const thumbs = (params.thumbs as boolean) || false;
        const format = (params.response_format as string) || 'markdown';

        const entry = await fetchApodByDate(date, thumbs);
        const output = transformApodEntry(entry);

        const text =
          format === ResponseFormat.JSON
            ? JSON.stringify(output, null, 2)
            : formatApodMarkdown(output);

        return truncateIfNeeded(text);
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    type: 'tool',
    name: 'apod_range',
    description: 'Get all Astronomy Pictures of the Day within a date range.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: {
          type: 'string',
          description: `Start date in YYYY-MM-DD format (earliest: ${APOD_START_DATE})`,
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (latest: today)',
        },
        thumbs: {
          type: 'boolean',
          description: 'Return thumbnail URLs for video content (default: false)',
        },
        response_format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
      required: ['start_date', 'end_date'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const startDate = params.start_date as string;
        const endDate = params.end_date as string;
        const thumbs = (params.thumbs as boolean) || false;
        const format = (params.response_format as string) || 'markdown';

        const entries = await fetchApodRange(startDate, endDate, thumbs);
        const transformed = entries.map(transformApodEntry);

        const output = {
          total: entries.length,
          count: transformed.length,
          entries: transformed,
          date_range: { start: startDate, end: endDate },
        };

        let text: string;
        if (format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# APODs from ${startDate} to ${endDate}\n\n**Found ${entries.length} entries**\n\n---\n\n`;
          const body = transformed.map(formatApodMarkdown).join('\n\n---\n\n');
          text = header + body;
        }

        return truncateIfNeeded(text);
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    type: 'tool',
    name: 'apod_random',
    description: 'Get random Astronomy Pictures of the Day from the entire archive.',
    inputSchema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: `Number of random entries to return (1-${MAX_ENTRIES}, default: ${DEFAULT_RANDOM_COUNT})`,
        },
        thumbs: {
          type: 'boolean',
          description: 'Return thumbnail URLs for video content (default: false)',
        },
        response_format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
    },
    async handler(params: Record<string, unknown>) {
      try {
        const count = (params.count as number) || DEFAULT_RANDOM_COUNT;
        const thumbs = (params.thumbs as boolean) || false;
        const format = (params.response_format as string) || 'markdown';

        const entries = await fetchRandomApods(count, thumbs);
        const transformed = entries.map(transformApodEntry);

        const output = {
          count: transformed.length,
          entries: transformed,
        };

        let text: string;
        if (format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# ${count} Random APODs\n\n---\n\n`;
          const body = transformed.map(formatApodMarkdown).join('\n\n---\n\n');
          text = header + body;
        }

        return truncateIfNeeded(text);
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    type: 'tool',
    name: 'apod_search',
    description:
      'Search the APOD archive by keyword. Searches titles and explanations for matching content.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords (2-200 characters)',
        },
        start_date: {
          type: 'string',
          description: 'Optional start date to limit search',
        },
        end_date: {
          type: 'string',
          description: 'Optional end date to limit search',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (1-50, default: 10)',
        },
        response_format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
      },
      required: ['query'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const query = params.query as string;
        const startDate = params.start_date as string | undefined;
        const endDate = params.end_date as string | undefined;
        const limit = (params.limit as number) || 10;
        const format = (params.response_format as string) || 'markdown';

        const matches = await searchApods(query, startDate, endDate, limit);

        if (matches.length === 0) {
          return `No APODs found matching "${query}". Try different keywords or expand the date range.`;
        }

        const output = {
          query,
          total: matches.length,
          count: matches.length,
          matches,
        };

        let text: string;
        if (format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const header = `# Search Results for "${query}"\n\n**Found ${matches.length} matches**\n\n---\n\n`;
          const body = matches
            .map((match, i) => {
              const base = formatApodMarkdown(match);
              return `### ${i + 1}. Relevance Score: ${match.relevance_score}\n\n${base}`;
            })
            .join('\n\n---\n\n');
          text = header + body;
        }

        return truncateIfNeeded(text);
      } catch (error) {
        return formatError(error);
      }
    },
  },
];
