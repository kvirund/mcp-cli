/**
 * NASA APOD MCP Server - Constants
 */

/** NASA APOD API base URL */
export const API_BASE_URL = "https://api.nasa.gov/planetary/apod";

/** Default API key (DEMO_KEY has rate limits but works for demos) */
export const DEFAULT_API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

/** Request timeout in milliseconds */
export const REQUEST_TIMEOUT = 30000;

/** Maximum character limit for responses to prevent context overflow */
export const CHARACTER_LIMIT = 50000;

/** Maximum entries per request */
export const MAX_ENTRIES = 100;

/** Default number of random entries */
export const DEFAULT_RANDOM_COUNT = 5;

/** APOD start date (first ever APOD) */
export const APOD_START_DATE = "1995-06-16";

/** Server configuration */
export const SERVER_NAME = "nasa-apod-mcp-server";
export const SERVER_VERSION = "1.0.0";

/** Default port for HTTP transport */
export const DEFAULT_PORT = 3000;
