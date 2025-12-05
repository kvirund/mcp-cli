/**
 * MCP tools for URL downloader plugin
 */

import type { PluginMcpTool } from '@kvirund/mcp-cli/plugin';
import { httpRequest, formatResponse } from './http-client.js';

export const urlDownloaderMcpTools: PluginMcpTool[] = [
  {
    type: 'tool',
    name: 'url_fetch',
    description: 'Fetch content from a URL using GET request',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers as key-value pairs',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        include_headers: {
          type: 'boolean',
          description: 'Include response headers in output',
        },
        body_only: {
          type: 'boolean',
          description: 'Return only the response body',
        },
      },
      required: ['url'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const response = await httpRequest(params.url as string, {
          method: 'GET',
          headers: params.headers as Record<string, string> | undefined,
          timeout: params.timeout as number | undefined,
        });

        return formatResponse(response, {
          includeHeaders: params.include_headers as boolean | undefined,
          bodyOnly: params.body_only as boolean | undefined,
        });
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : error}`;
      }
    },
  },
  {
    type: 'tool',
    name: 'url_request',
    description: 'Make an HTTP request with full control over method, headers, and body',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to request',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
          description: 'HTTP method (default: GET)',
        },
        headers: {
          type: 'object',
          description: 'HTTP headers as key-value pairs',
        },
        body: {
          type: 'string',
          description: 'Request body (for POST, PUT, PATCH)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        follow_redirects: {
          type: 'boolean',
          description: 'Follow redirects (default: true)',
        },
        include_headers: {
          type: 'boolean',
          description: 'Include response headers in output',
        },
        body_only: {
          type: 'boolean',
          description: 'Return only the response body',
        },
      },
      required: ['url'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const response = await httpRequest(params.url as string, {
          method: (params.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS') || 'GET',
          headers: params.headers as Record<string, string> | undefined,
          body: params.body as string | undefined,
          timeout: params.timeout as number | undefined,
          followRedirects: params.follow_redirects as boolean | undefined,
        });

        return formatResponse(response, {
          includeHeaders: params.include_headers as boolean | undefined,
          bodyOnly: params.body_only as boolean | undefined,
        });
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : error}`;
      }
    },
  },
  {
    type: 'tool',
    name: 'url_post',
    description: 'POST data to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to POST to',
        },
        body: {
          type: 'string',
          description: 'The request body',
        },
        content_type: {
          type: 'string',
          description: 'Content-Type header (auto-detected if not set)',
        },
        headers: {
          type: 'object',
          description: 'Additional HTTP headers',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
        include_headers: {
          type: 'boolean',
          description: 'Include response headers in output',
        },
        body_only: {
          type: 'boolean',
          description: 'Return only the response body',
        },
      },
      required: ['url', 'body'],
    },
    async handler(params: Record<string, unknown>) {
      const headers: Record<string, string> = { ...(params.headers as Record<string, string>) };
      const body = params.body as string;

      // Set content type
      if (params.content_type) {
        headers['Content-Type'] = params.content_type as string;
      } else if (!headers['Content-Type'] && !headers['content-type']) {
        // Auto-detect
        if (body.startsWith('{') || body.startsWith('[')) {
          headers['Content-Type'] = 'application/json';
        } else {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      try {
        const response = await httpRequest(params.url as string, {
          method: 'POST',
          headers,
          body,
          timeout: params.timeout as number | undefined,
        });

        return formatResponse(response, {
          includeHeaders: params.include_headers as boolean | undefined,
          bodyOnly: params.body_only as boolean | undefined,
        });
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : error}`;
      }
    },
  },
  {
    type: 'tool',
    name: 'url_head',
    description: 'Get HTTP headers for a URL without downloading the body',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to check',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['url'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const response = await httpRequest(params.url as string, {
          method: 'HEAD',
          headers: params.headers as Record<string, string> | undefined,
          timeout: params.timeout as number | undefined,
        });

        const lines: string[] = [
          `HTTP ${response.status} ${response.statusText}`,
          `URL: ${response.url}`,
          `Time: ${response.timing.duration}ms`,
          '',
        ];

        for (const [key, value] of Object.entries(response.headers)) {
          lines.push(`${key}: ${value}`);
        }

        return lines.join('\n');
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : error}`;
      }
    },
  },
  {
    type: 'tool',
    name: 'url_json',
    description: 'Fetch JSON from a URL and return parsed content',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch JSON from',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 30000)',
        },
      },
      required: ['url'],
    },
    async handler(params: Record<string, unknown>) {
      try {
        const response = await httpRequest(params.url as string, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            ...(params.headers as Record<string, string>),
          },
          timeout: params.timeout as number | undefined,
        });

        if (response.status < 200 || response.status >= 400) {
          return `Error: HTTP ${response.status}: ${response.statusText}`;
        }

        // Try to parse and pretty-print JSON
        try {
          const json = JSON.parse(response.body);
          return JSON.stringify(json, null, 2);
        } catch {
          return response.body;
        }
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : error}`;
      }
    },
  },
];
