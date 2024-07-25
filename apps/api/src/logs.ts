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

export type LogState = {
  /**
   * The cursor for the current log line.
   */
  current: number;
  /**
   * The max number of logs to yield.
   */
  limit: number;
  /**
   * An offset to start reading logs from.
   */
  offset: number;
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
 * Create a transform stream that parses syslog lines into an array of objects.
 * Also, add the year to the timestamp if it's missing.
 */
const createLogTransform = ({
  abort,
  state,
  stats,
}: {
  abort: AbortController;
  state: LogState;
  stats: Stats;
}) =>
  new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(chunk, _encoding, callback) {
      let lines: string = chunk.toString().split('\n');
      const logs: Log[] = [];

      // If we're not at the offset yet...
      if (state.current < state.offset) {
        // But taking _some_ of these logs will get us there...
        // Ex. if we're at 0, and the offset is 100, and we have 300 lines,
        // then we want to take lines 101-300.
        if (state.current + lines.length >= state.offset) {
          const overrun = state.current + lines.length - state.offset;
          state.current = state.offset;
          lines = lines.slice(lines.length - overrun);
        } else {
          state.current += lines.length;
          return;
        }
      }

      state.current += lines.length;

      // Stop processing if we've reached the limit
      if (state.limit && state.current > state.limit + state.offset) {
        lines = lines.slice(
          0,
          state.limit + state.offset - (state.current - lines.length),
        );
        abort.abort('test');
      }

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

      callback(null, logs);
    },
  });

/**
 * Create a transform that casts an array of objects to a JSON string.
 */
const createJsonTransform = ({ state }: { state: LogState }) =>
  new Transform({
    readableObjectMode: true,
    writableObjectMode: true,
    transform(chunk, _encoding, callback) {
      const logs: Log[] = chunk as Log[];
      const from = state.offset;
      const to = state.offset + logs.length;
      const next = logs.length < state.limit ? null : to + 1;

      callback(
        null,
        `${JSON.stringify({
          data: logs,
          meta: {
            from,
            next,
            to,
          },
        })}\n`,
      );
    },
  });

/**
 * Pipe logs from the given handles to the response, transforming them
 * to JSON along the way.
 * @todo: use merge-streams (an external library!) to pipe multiple streams
 * together, so we combine multiple log files into one stream and read
 * them in parallel, applying limit and offset to them. This current implementation
 * will read them serially, so if the first file has more than the limit, we'll
 * never see something from the second file.
 */
export const pipeLogs = async (
  handles: FileHandle[],
  res: Response,
  { limit = 1000, offset = 0 }: Partial<Omit<LogState, 'current'>>,
) => {
  // An abort controller to allow us to cancel the pipeline
  const abort = new AbortController();

  // Create state to pass to the transform streams
  const state: LogState = { current: 0, limit, offset };

  for (const handle of handles) {
    try {
      await pipeline(
        handle.createReadStream(),
        createLogTransform({ abort, state, stats: await handle.stat() }),
        createJsonTransform({ state }),
        res,
        { signal: abort.signal },
      );
    } catch (err) {
      // if ((err as Error)?.name === 'AbortError') {
      //   break;
      // }
      console.error('Pipeline failed', err);
      res.status(500).send('Internal Server Error');
    }
  }

  handles.forEach((handle) => handle.close());

  res.end();
};
