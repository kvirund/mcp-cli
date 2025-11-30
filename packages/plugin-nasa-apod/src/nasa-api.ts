/**
 * NASA APOD Plugin - API Client
 */

import type { ApodEntry, ApodOutput } from './types.js';
import { API_BASE_URL, getApiKey, REQUEST_TIMEOUT } from './constants.js';

/**
 * Custom error for API failures
 */
export class NasaApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'NasaApiError';
  }
}

/**
 * Build URL with query parameters
 */
function buildUrl(params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('api_key', getApiKey());

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/**
 * Make API request with timeout and error handling
 */
async function makeRequest<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');

      if (response.status === 429) {
        throw new NasaApiError(
          'Rate limit exceeded',
          429,
          'The DEMO_KEY has hourly limits. Set NASA_API_KEY environment variable with your own key from https://api.nasa.gov'
        );
      }

      if (response.status === 400) {
        throw new NasaApiError(
          `Invalid request: ${errorText}`,
          400,
          'Check that dates are in YYYY-MM-DD format and within valid range'
        );
      }

      throw new NasaApiError(`NASA API error: ${response.status} - ${errorText}`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof NasaApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new NasaApiError(
        'Request timed out',
        undefined,
        'The NASA API may be slow. Try again in a moment.'
      );
    }

    throw new NasaApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      'Check your internet connection'
    );
  }
}

/**
 * Transform raw APOD entry to structured output
 */
export function transformApodEntry(entry: ApodEntry): ApodOutput {
  return {
    date: entry.date,
    title: entry.title,
    explanation: entry.explanation,
    media_type: entry.media_type,
    url: entry.url,
    ...(entry.hdurl && { hd_url: entry.hdurl }),
    ...(entry.thumbnail_url && { thumbnail_url: entry.thumbnail_url }),
    ...(entry.copyright && { copyright: entry.copyright }),
  };
}

/**
 * Strip non-printable characters, keeping only printable ASCII and newlines
 */
function stripNonPrintable(s: string): string {
  // Keep only printable ASCII (0x20-0x7E) and newline (0x0A)
  return s.replace(/[^\x20-\x7E\n]/g, '');
}

/**
 * Format APOD entry as markdown
 */
export function formatApodMarkdown(entry: ApodOutput): string {
  // Clean and strip non-printable, then collapse whitespace for single-line fields
  const cleanLine = (s: string) =>
    stripNonPrintable(s)
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // Clean multi-line text - strip non-printable but keep newlines
  const cleanText = (s: string) => stripNonPrintable(s).trim();

  const lines: string[] = [
    cleanLine(entry.title),
    `Date: ${cleanLine(entry.date)}`,
    `Type: ${entry.media_type === 'video' ? 'Video' : 'Image'}`,
  ];

  if (entry.copyright) {
    lines.push(`Copyright: ${cleanLine(entry.copyright)}`);
  }

  lines.push('');
  lines.push(cleanText(entry.explanation));
  lines.push('');
  lines.push(`View: ${cleanLine(entry.url)}`);

  if (entry.hd_url) {
    lines.push(`HD: ${cleanLine(entry.hd_url)}`);
  }

  if (entry.thumbnail_url) {
    lines.push(`Thumbnail: ${cleanLine(entry.thumbnail_url)}`);
  }

  return lines.join('\n');
}

/**
 * Fetch today's APOD
 */
export async function fetchTodayApod(thumbs: boolean = false): Promise<ApodEntry> {
  const url = buildUrl({ thumbs });
  return makeRequest<ApodEntry>(url);
}

/**
 * Fetch APOD for a specific date
 */
export async function fetchApodByDate(date: string, thumbs: boolean = false): Promise<ApodEntry> {
  const url = buildUrl({ date, thumbs });
  return makeRequest<ApodEntry>(url);
}

/**
 * Fetch APODs for a date range
 */
export async function fetchApodRange(
  startDate: string,
  endDate: string,
  thumbs: boolean = false
): Promise<ApodEntry[]> {
  const url = buildUrl({ start_date: startDate, end_date: endDate, thumbs });
  return makeRequest<ApodEntry[]>(url);
}

/**
 * Fetch random APODs
 */
export async function fetchRandomApods(
  count: number,
  thumbs: boolean = false
): Promise<ApodEntry[]> {
  const url = buildUrl({ count, thumbs });
  return makeRequest<ApodEntry[]>(url);
}

/**
 * Search APODs by keyword (fetches range and filters locally)
 */
export async function searchApods(
  query: string,
  startDate?: string,
  endDate?: string,
  limit: number = 10
): Promise<Array<ApodOutput & { relevance_score: number }>> {
  // Determine date range - default to last 365 days if not specified
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const start = startDate || oneYearAgo.toISOString().split('T')[0];
  const end = endDate || today.toISOString().split('T')[0];

  // Fetch the range
  const entries = await fetchApodRange(start, end, true);

  // Normalize query for matching
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  // Score and filter entries
  const scored = entries.map((entry) => {
    const titleLower = entry.title.toLowerCase();
    const explanationLower = entry.explanation.toLowerCase();

    let score = 0;
    for (const term of queryTerms) {
      // Title matches are worth more
      if (titleLower.includes(term)) {
        score += 10;
        // Exact word match bonus
        if (new RegExp(`\\b${term}\\b`).test(titleLower)) {
          score += 5;
        }
      }

      // Explanation matches
      if (explanationLower.includes(term)) {
        score += 3;
        // Count occurrences (capped)
        const matches = explanationLower.split(term).length - 1;
        score += Math.min(matches, 5);
      }
    }

    return {
      entry: transformApodEntry(entry),
      score,
    };
  });

  // Filter and sort by relevance
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.entry,
      relevance_score: item.score,
    }));
}
