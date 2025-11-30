/**
 * NASA APOD Plugin - Type Definitions
 */

/**
 * Response format options
 */
export enum ResponseFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
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
  media_type: 'image' | 'video';
  thumbnail_url?: string;
  copyright?: string;
  service_version: string;
}

/**
 * Structured output for single APOD
 */
export interface ApodOutput {
  date: string;
  title: string;
  explanation: string;
  media_type: 'image' | 'video';
  url: string;
  hd_url?: string;
  thumbnail_url?: string;
  copyright?: string;
}
