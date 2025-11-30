/**
 * NASA APOD MCP Server - Type Definitions
 */

/**
 * Response format options
 */
export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json"
}

/**
 * APOD entry from NASA API
 */
export interface ApodEntry {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: "image" | "video";
  thumbnail_url?: string;
  copyright?: string;
  service_version: string;
}

/**
 * Structured output for single APOD
 * Includes index signature for MCP SDK compatibility
 */
export interface ApodOutput {
  [key: string]: unknown;
  date: string;
  title: string;
  explanation: string;
  media_type: "image" | "video";
  url: string;
  hd_url?: string;
  thumbnail_url?: string;
  copyright?: string;
}

/**
 * Structured output for APOD list
 */
export interface ApodListOutput {
  [key: string]: unknown;
  total: number;
  count: number;
  entries: ApodOutput[];
  date_range: {
    start: string;
    end: string;
  };
}

/**
 * Structured output for random APODs
 */
export interface ApodRandomOutput {
  [key: string]: unknown;
  count: number;
  entries: ApodOutput[];
}

/**
 * Structured output for search results
 */
export interface ApodSearchOutput {
  [key: string]: unknown;
  query: string;
  total: number;
  count: number;
  matches: Array<ApodOutput & { relevance_score: number }>;
}

/**
 * Error response structure
 */
export interface ErrorOutput {
  error: string;
  suggestion?: string;
}

/**
 * API configuration
 */
export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}
