/**
 * HTTP client for URL downloading
 * Provides curl-like functionality using Node.js fetch
 */

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
  redirected: boolean;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_REDIRECTS = 10;

/**
 * Perform an HTTP request
 */
export async function httpRequest(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    followRedirects = true,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
  } = options;

  const startTime = Date.now();

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'User-Agent': 'mcp-cli-url-downloader/0.1.0',
        ...headers,
      },
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual',
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = body;
    }

    let response: Response;
    let redirectCount = 0;
    let currentUrl = url;

    if (!followRedirects) {
      response = await fetch(currentUrl, fetchOptions);
    } else {
      // Manual redirect handling to count redirects
      fetchOptions.redirect = 'manual';
      response = await fetch(currentUrl, fetchOptions);

      while (
        response.status >= 300 &&
        response.status < 400 &&
        redirectCount < maxRedirects
      ) {
        const location = response.headers.get('location');
        if (!location) break;

        currentUrl = new URL(location, currentUrl).toString();
        response = await fetch(currentUrl, fetchOptions);
        redirectCount++;
      }

      if (redirectCount >= maxRedirects) {
        throw new Error(`Too many redirects (max: ${maxRedirects})`);
      }
    }

    const endTime = Date.now();

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Read body as text
    const responseBody = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      url: response.url || currentUrl,
      redirected: redirectCount > 0,
      timing: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Format response for display
 */
export function formatResponse(
  response: HttpResponse,
  options: {
    includeHeaders?: boolean;
    includeStatus?: boolean;
    includeTiming?: boolean;
    bodyOnly?: boolean;
  } = {}
): string {
  const {
    includeHeaders = false,
    includeStatus = true,
    includeTiming = true,
    bodyOnly = false,
  } = options;

  if (bodyOnly) {
    return response.body;
  }

  const lines: string[] = [];

  if (includeStatus) {
    lines.push(`HTTP ${response.status} ${response.statusText}`);
    lines.push(`URL: ${response.url}`);
    if (response.redirected) {
      lines.push('(redirected)');
    }
  }

  if (includeTiming) {
    lines.push(`Time: ${response.timing.duration}ms`);
  }

  if (includeHeaders) {
    lines.push('');
    lines.push('--- Headers ---');
    for (const [key, value] of Object.entries(response.headers)) {
      lines.push(`${key}: ${value}`);
    }
  }

  if (response.body) {
    lines.push('');
    lines.push('--- Body ---');
    lines.push(response.body);
  }

  return lines.join('\n');
}

/**
 * Parse header string (like curl -H "Name: Value")
 */
export function parseHeaderString(header: string): [string, string] | null {
  const colonIndex = header.indexOf(':');
  if (colonIndex === -1) return null;

  const name = header.slice(0, colonIndex).trim();
  const value = header.slice(colonIndex + 1).trim();

  return [name, value];
}

/**
 * Parse multiple header strings into an object
 */
export function parseHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const header of headers) {
    const parsed = parseHeaderString(header);
    if (parsed) {
      result[parsed[0]] = parsed[1];
    }
  }

  return result;
}
