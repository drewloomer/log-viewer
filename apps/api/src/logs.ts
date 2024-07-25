import { type Response } from 'express';
import { type FileHandle, open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import { getFiles } from './files.js';
import { LOG_PATH } from './consts.js';
import { Transform } from 'node:stream';
import { Stats } from 'node:fs';

/**
 * Get a handle for each file, or log an error if it can't be opened.
 * @todo: instead of eating a not found/allowed error we should inform
 * the user that the file couldn't be opened for whatever reason.
 */
export const getLogHandles = async ({ fileName }: { fileName: string }) => {
  const files = await getFiles();
  const fileNames = fileName.split(',');

  if (!fileNames.length) {
    return;
  }

  const handles: FileHandle[] = [];

  for (const name of fileNames) {
    const path = join(LOG_PATH, `${name}`);

    try {
      const handle = await open(path, 'r');

      // Don't allow access to files that aren't in the list
      if (!files.find((file) => file.path === path)) {
        throw new Error(`👮 Access to ${name} not allowed!`);
      }

      handles.push(handle);
    } catch (e) {
      console.error(`🚨 Couldn't open file ${name}!`, e);
    }
  }

  return handles;
};

export type Log = {
  host?: string;
  message: string;
  pid?: number;
  process?: string;
  timestamp?: string;
};

const iso8601Regex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/;
const dateWithOffsetRegex =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:?\d{2})/;
const dateWithoutYearRegex =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2}/;
const dateWithYearAndOffsetRegex =
  /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{4})/;
const dateWithYearRegex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/;

/**
 * Parse a syslog entry, with various date formats, into a structured object.
 */
const parseSyslog = (log: string, defaultYear?: number): Log => {
  const match =
    log.match(iso8601Regex) ||
    log.match(dateWithOffsetRegex) ||
    log.match(dateWithYearAndOffsetRegex) ||
    log.match(dateWithYearRegex) ||
    log.match(dateWithoutYearRegex);

  if (!match) {
    throw new Error('Invalid syslog format!');
  }

  let timestamp = match[0];

  // Remove the timestamp part from the syslog string
  const remaining = log.slice(timestamp.length).trim();

  // If the timestamp does not include a year, prepend the default year
  if (dateWithoutYearRegex.test(timestamp) && defaultYear) {
    const [month, day, time] = timestamp.split(' ');
    timestamp = `${defaultYear} ${month} ${day} ${time}`;
  }

  // Further split the remaining part to get the hostname, process, pid, and message
  const [host, appWithProcId, ...messageParts] = remaining.split(' ');
  const [proc, procId] = appWithProcId.includes('[')
    ? appWithProcId.split('[')
    : [appWithProcId, undefined];

  const message = messageParts.join(' ').replace(']:', '').trim();

  return {
    timestamp: new Date(timestamp).toISOString(),
    host,
    process: proc.replace(':', ''),
    pid: procId
      ? parseInt(procId.replace(']:', '').replace(']', ''), 10)
      : undefined,
    message,
  };
};

/**
 * Create a transform stream that parses syslog lines into JSON.
 * Also, add the year to the timestamp if it's missing.
 */
const createJsonTransform = (stats: Stats) =>
  new Transform({
    transform(chunk, _encoding, callback) {
      const lines: string = chunk.toString().split('\n');
      const logs: Log[] = [];

      for (const line of lines) {
        try {
          if (!line) {
            continue;
          }
          logs.push(parseSyslog(line, stats.birthtime.getFullYear()));
        } catch (_e) {
          logs.push({ message: line });
        }
      }

      callback(null, JSON.stringify(logs));
    },
  });

/**
 * Pipe logs from the given handles to the response, transforming them
 * to JSON along the way.
 */
export const pipeLogs = async (handles: FileHandle[], res: Response) => {
  for (const handle of handles) {
    try {
      await pipeline(
        handle.createReadStream(),
        createJsonTransform(await handle.stat()),
        res,
      );
    } catch (err) {
      console.error('Pipeline failed', err);
      res.status(500).send('Internal Server Error');
      return;
    }
  }

  handles.forEach((handle) => handle.close());

  res.end();
};
