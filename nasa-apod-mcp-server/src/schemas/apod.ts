/**
 * NASA APOD MCP Server - Zod Schemas
 */

import { z } from "zod";
import { ResponseFormat } from "../types.js";
import { APOD_START_DATE, MAX_ENTRIES, DEFAULT_RANDOM_COUNT } from "../constants.js";

/**
 * Date validation helper - ensures date is in YYYY-MM-DD format and within valid range
 */
const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .refine((date) => {
    const d = new Date(date);
    const start = new Date(APOD_START_DATE);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d >= start && d <= today;
  }, `Date must be between ${APOD_START_DATE} and today`);

/**
 * Response format schema
 */
const responseFormatSchema = z.nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for structured data");

/**
 * Schema for getting today's APOD
 */
export const GetTodayApodSchema = z.object({
  thumbs: z.boolean()
    .default(false)
    .describe("Return thumbnail URL for video content"),
  response_format: responseFormatSchema
}).strict();

export type GetTodayApodInput = z.infer<typeof GetTodayApodSchema>;

/**
 * Schema for getting APOD by specific date
 */
export const GetApodByDateSchema = z.object({
  date: dateSchema
    .describe(`Date in YYYY-MM-DD format (earliest: ${APOD_START_DATE})`),
  thumbs: z.boolean()
    .default(false)
    .describe("Return thumbnail URL for video content"),
  response_format: responseFormatSchema
}).strict();

export type GetApodByDateInput = z.infer<typeof GetApodByDateSchema>;

/**
 * Schema for getting APOD range
 */
export const GetApodRangeSchema = z.object({
  start_date: dateSchema
    .describe(`Start date in YYYY-MM-DD format (earliest: ${APOD_START_DATE})`),
  end_date: dateSchema
    .describe("End date in YYYY-MM-DD format (latest: today)"),
  thumbs: z.boolean()
    .default(false)
    .describe("Return thumbnail URLs for video content"),
  response_format: responseFormatSchema
}).strict().refine((data) => {
  return new Date(data.start_date) <= new Date(data.end_date);
}, "start_date must be before or equal to end_date");

export type GetApodRangeInput = z.infer<typeof GetApodRangeSchema>;

/**
 * Schema for getting random APODs
 */
export const GetRandomApodsSchema = z.object({
  count: z.number()
    .int()
    .min(1)
    .max(MAX_ENTRIES)
    .default(DEFAULT_RANDOM_COUNT)
    .describe(`Number of random entries (1-${MAX_ENTRIES})`),
  thumbs: z.boolean()
    .default(false)
    .describe("Return thumbnail URLs for video content"),
  response_format: responseFormatSchema
}).strict();

export type GetRandomApodsInput = z.infer<typeof GetRandomApodsSchema>;

/**
 * Schema for searching APODs by keyword
 */
export const SearchApodsSchema = z.object({
  query: z.string()
    .min(2, "Query must be at least 2 characters")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search keywords to match against titles and explanations"),
  start_date: dateSchema
    .optional()
    .describe(`Optional start date to limit search (earliest: ${APOD_START_DATE})`),
  end_date: dateSchema
    .optional()
    .describe("Optional end date to limit search (latest: today)"),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum results to return (1-50)"),
  response_format: responseFormatSchema
}).strict();

export type SearchApodsInput = z.infer<typeof SearchApodsSchema>;
