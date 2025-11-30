/**
 * CLI commands for NASA APOD plugin
 */

import type { Command, CommandResult } from '@anthropic/mcp-cli-core';
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
import { DEFAULT_RANDOM_COUNT, CHARACTER_LIMIT } from './constants.js';

function truncateIfNeeded(text: string): string {
  // Remove all carriage returns that could cause display issues
  const cleaned = text.replace(/\r/g, '');
  if (cleaned.length <= CHARACTER_LIMIT) {
    return cleaned;
  }
  return cleaned.slice(0, CHARACTER_LIMIT) + '\n\n... [Response truncated]';
}

// Sanitize output for terminal display
function sanitizeOutput(text: string): string {
  return text.replace(/\r/g, '');
}

function formatError(error: unknown): CommandResult {
  if (error instanceof NasaApiError) {
    const msg = error.suggestion
      ? `Error: ${error.message}\nSuggestion: ${error.suggestion}`
      : `Error: ${error.message}`;
    return { output: msg, success: false };
  }
  return {
    output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    success: false,
  };
}

export const nasaApodCommands: Command[] = [
  {
    name: 'apod',
    description: "Get today's Astronomy Picture of the Day",
    aliases: ['today'],

    async execute(): Promise<CommandResult> {
      try {
        const entry = await fetchTodayApod(true);
        const output = transformApodEntry(entry);
        return {
          output: sanitizeOutput(formatApodMarkdown(output)),
          success: true,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    name: 'apod-date',
    description: 'Get APOD for a specific date',
    args: [
      {
        name: 'date',
        description: 'Date in YYYY-MM-DD format',
        required: true,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [date] = args;
      if (!date) {
        return {
          output: 'Usage: apod-date <YYYY-MM-DD>',
          success: false,
        };
      }

      try {
        const entry = await fetchApodByDate(date, true);
        const output = transformApodEntry(entry);
        return {
          output: sanitizeOutput(formatApodMarkdown(output)),
          success: true,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    name: 'apod-random',
    description: 'Get random APODs',
    args: [
      {
        name: 'count',
        description: `Number of random entries (default: ${DEFAULT_RANDOM_COUNT})`,
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const count = args[0] ? parseInt(args[0], 10) : DEFAULT_RANDOM_COUNT;

      if (isNaN(count) || count < 1 || count > 100) {
        return {
          output: 'Count must be between 1 and 100',
          success: false,
        };
      }

      try {
        const entries = await fetchRandomApods(count, true);
        const transformed = entries.map(transformApodEntry);
        const output = transformed.map(formatApodMarkdown).join('\n\n---\n\n');
        return {
          output: sanitizeOutput(`# ${count} Random APODs\n\n${output}`),
          success: true,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    name: 'apod-range',
    description: 'Get APODs for a date range',
    args: [
      {
        name: 'start_date',
        description: 'Start date (YYYY-MM-DD)',
        required: true,
      },
      {
        name: 'end_date',
        description: 'End date (YYYY-MM-DD)',
        required: true,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [startDate, endDate] = args;
      if (!startDate || !endDate) {
        return {
          output: 'Usage: apod-range <start_date> <end_date>',
          success: false,
        };
      }

      try {
        const entries = await fetchApodRange(startDate, endDate, true);
        const transformed = entries.map(transformApodEntry);
        const header = `# APODs from ${startDate} to ${endDate}\n\n**Found ${entries.length} entries**\n\n---\n\n`;
        const body = transformed.map(formatApodMarkdown).join('\n\n---\n\n');
        return {
          output: truncateIfNeeded(header + body),
          success: true,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  },

  {
    name: 'apod-search',
    description: 'Search APODs by keyword',
    args: [
      {
        name: 'query',
        description: 'Search keywords',
        required: true,
      },
      {
        name: 'limit',
        description: 'Max results (default: 10)',
        required: false,
      },
    ],

    async execute(args: string[]): Promise<CommandResult> {
      const [query, limitStr] = args;
      if (!query) {
        return {
          output: 'Usage: apod-search <query> [limit]',
          success: false,
        };
      }

      const limit = limitStr ? parseInt(limitStr, 10) : 10;
      if (isNaN(limit) || limit < 1 || limit > 50) {
        return {
          output: 'Limit must be between 1 and 50',
          success: false,
        };
      }

      try {
        const matches = await searchApods(query, undefined, undefined, limit);

        if (matches.length === 0) {
          return {
            output: `No APODs found matching "${query}". Try different keywords.`,
            success: true,
          };
        }

        const header = `# Search Results for "${query}"\n\n**Found ${matches.length} matches**\n\n---\n\n`;
        const body = matches
          .map((match, i) => {
            const base = formatApodMarkdown(match);
            return `### ${i + 1}. Relevance: ${match.relevance_score}\n\n${base}`;
          })
          .join('\n\n---\n\n');

        return {
          output: truncateIfNeeded(header + body),
          success: true,
        };
      } catch (error) {
        return formatError(error);
      }
    },
  },
];
