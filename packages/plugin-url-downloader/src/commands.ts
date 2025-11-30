/**
 * CLI commands for URL downloader plugin
 */

import type { Command } from '@anthropic/mcp-cli-core';
import { httpRequest, formatResponse, parseHeaders } from './http-client.js';

export const urlDownloaderCommands: Command[] = [
  {
    name: 'fetch',
    description: 'Fetch a URL (GET request). Use -h for headers, -b for body only',

    async execute(args) {
      const url = args[0];
      if (!url) {
        return { output: 'Usage: fetch <url> [-h] [-b]\n  -h  Include headers\n  -b  Body only', success: false };
      }

      const includeHeaders = args.includes('-h');
      const bodyOnly = args.includes('-b');

      try {
        const response = await httpRequest(url);
        return {
          output: formatResponse(response, { includeHeaders, bodyOnly }),
          success: response.status >= 200 && response.status < 400,
        };
      } catch (error) {
        return {
          output: `Error: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },
  {
    name: 'http',
    description: 'Make HTTP request: http <method> <url> [-H "Header: Value"] [-d "data"]',

    async execute(args) {
      if (args.length < 2) {
        return {
          output: 'Usage: http <method> <url> [-H "Header: Value"] [-d "data"] [-h] [-b]\n' +
            '  Methods: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS\n' +
            '  -H  Add header (can be used multiple times)\n' +
            '  -d  Request body data\n' +
            '  -h  Include response headers\n' +
            '  -b  Body only output',
          success: false,
        };
      }

      const method = args[0].toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
      const url = args[1];

      // Parse options
      const headerStrings: string[] = [];
      let body: string | undefined;
      let includeHeaders = false;
      let bodyOnly = false;

      for (let i = 2; i < args.length; i++) {
        if (args[i] === '-H' && args[i + 1]) {
          headerStrings.push(args[++i]);
        } else if (args[i] === '-d' && args[i + 1]) {
          body = args[++i];
        } else if (args[i] === '-h') {
          includeHeaders = true;
        } else if (args[i] === '-b') {
          bodyOnly = true;
        }
      }

      const headers = parseHeaders(headerStrings);

      try {
        const response = await httpRequest(url, { method, headers, body });
        return {
          output: formatResponse(response, { includeHeaders, bodyOnly }),
          success: response.status >= 200 && response.status < 400,
        };
      } catch (error) {
        return {
          output: `Error: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },
  {
    name: 'post',
    description: 'POST data to a URL: post <url> <data> [-H "Header: Value"]',

    async execute(args) {
      if (args.length < 2) {
        return {
          output: 'Usage: post <url> <data> [-H "Header: Value"] [-h] [-b]',
          success: false,
        };
      }

      const url = args[0];
      const body = args[1];

      // Parse options
      const headerStrings: string[] = [];
      let includeHeaders = false;
      let bodyOnly = false;

      for (let i = 2; i < args.length; i++) {
        if (args[i] === '-H' && args[i + 1]) {
          headerStrings.push(args[++i]);
        } else if (args[i] === '-h') {
          includeHeaders = true;
        } else if (args[i] === '-b') {
          bodyOnly = true;
        }
      }

      const headers = parseHeaders(headerStrings);

      // Auto-detect content type if not set
      if (!headers['Content-Type'] && !headers['content-type']) {
        if (body.startsWith('{') || body.startsWith('[')) {
          headers['Content-Type'] = 'application/json';
        } else {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      try {
        const response = await httpRequest(url, { method: 'POST', headers, body });
        return {
          output: formatResponse(response, { includeHeaders, bodyOnly }),
          success: response.status >= 200 && response.status < 400,
        };
      } catch (error) {
        return {
          output: `Error: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },
  {
    name: 'head',
    description: 'Get headers only (HEAD request)',

    async execute(args) {
      const url = args[0];
      if (!url) {
        return { output: 'Usage: head <url>', success: false };
      }

      try {
        const response = await httpRequest(url, { method: 'HEAD' });
        const lines: string[] = [
          `HTTP ${response.status} ${response.statusText}`,
          `URL: ${response.url}`,
          `Time: ${response.timing.duration}ms`,
          '',
          '--- Headers ---',
        ];

        for (const [key, value] of Object.entries(response.headers)) {
          lines.push(`${key}: ${value}`);
        }

        return {
          output: lines.join('\n'),
          success: response.status >= 200 && response.status < 400,
        };
      } catch (error) {
        return {
          output: `Error: ${error instanceof Error ? error.message : error}`,
          success: false,
        };
      }
    },
  },
];
