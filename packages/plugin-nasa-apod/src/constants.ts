/**
 * NASA APOD Plugin - Constants
 */

/** NASA APOD API base URL */
export const API_BASE_URL = 'https://api.nasa.gov/planetary/apod';

/** Fallback API key (DEMO_KEY has rate limits but works for demos) */
export const FALLBACK_API_KEY = 'DEMO_KEY';

/** Default API key (from env) */
export const DEFAULT_API_KEY = process.env.NASA_API_KEY || FALLBACK_API_KEY;

// Plugin config storage - set by plugin init
let configApiKey: string | undefined;

/**
 * Set API key from plugin config
 */
export function setConfigApiKey(key: string | undefined): void {
  configApiKey = key;
}

/**
 * Get current API key (config > env > DEMO_KEY)
 */
export function getApiKey(): string {
  return configApiKey || process.env.NASA_API_KEY || FALLBACK_API_KEY;
}

/**
 * Check if using a custom API key (not DEMO_KEY)
 */
export function hasCustomApiKey(): boolean {
  return getApiKey() !== FALLBACK_API_KEY;
}

/** Request timeout in milliseconds */
export const REQUEST_TIMEOUT = 30000;

/** Maximum character limit for responses */
export const CHARACTER_LIMIT = 50000;

/** Maximum entries per request */
export const MAX_ENTRIES = 100;

/** Default number of random entries */
export const DEFAULT_RANDOM_COUNT = 5;

/** APOD start date (first ever APOD) */
export const APOD_START_DATE = '1995-06-16';
