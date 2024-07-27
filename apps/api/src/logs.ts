import { type Response } from 'express';
import { spawn } from 'node:child_process';
import { type Stats } from 'node:fs';
import { join } from 'node:path';
import { PassThrough, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { LOG_PATH } from './consts.js';
import { getFile } from './files.js';
import { ApiResponse, Log } from './models.js';
import { parseSyslog } from './helpers/parseSyslog.js';
import { run } from './helpers/run.js';

type LogState = {
  /**
   * The max number of logs to yield.
   */
  limit: number;
  /**
   * An offset to start reading logs from.
   */
  offset: number;
  /**
   * An optional search query to filter logs by.
   */
  search?: string;
};

/**
 * A Transform stream that buffers chunks until they form complete lines.
 * Useful so that if a chunk ends mid-line, we don't accidentally parse it.
 */
const createLineBuffer = () => {
  let buffer: string | undefined = '';
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      // Add the chunk to the buffer and split it into lines
      buffer += chunk.toString();
      const lines = buffer?.split('\n') ?? [];

      // Keep the last partial line in the buffer
      buffer = lines.pop();

      // Push each line to the stream
      lines.forEach((line) => this.push(line));

      callback();
    },
    flush(callback) {
      // If there is a partial line left at the end, push it to the buffer
      if (buffer) {
        this.push(buffer);
        buffer = '';
      }
      callback();
    },
  });
};

/**
 * Create a transform stream that parses syslog lines into an array of objects.
 * Also, add the year to the timestamp if it's missing.
 */
const createLogTransform = ({ stats }: { stats: Stats }) =>
  new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      const lines: string = chunk.toString().trim().split('\n');
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

      callback(null, logs);
    },
  });

/**
 * Create a transform that casts an array of objects to a JSON string.
 */
const createResponseBody = ({
  hasMore,
  logs,
  offset,
}: {
  hasMore: boolean;
  logs: Log[];
  offset: number;
}): ApiResponse<Log[]> => {
  // Update meta to reflect the actual number of results
  const to = offset + logs.length - 1;
  const from = offset;
  const next = hasMore ? to + 1 : undefined;
  return {
    data: logs.reverse(),
    meta: {
      count: logs.length,
      from,
      next,
      to,
    },
  };
};

/**
 * Pipe logs from the given files to the response, transforming them
 * to JSON along the way.
 */
export const pipeLogs = async (
  fileName: string,
  res: Response,
  { limit = 1000, offset = 0, search }: Partial<Omit<LogState, 'current'>>,
) => {
  const fileNames = fileName.split(',');

  // Don't allow more than 1000 lines to be returned in one call
  limit = Math.min(limit, 1000);

  // Loop through each file and pipe logs to the response
  for (const file of fileNames) {
    try {
      // Make sure the requested log file exists
      const matchingFile = await getFile(file);

      if (!matchingFile) {
        res.setHeader('Content-Type', 'text/plain');
        res.status(404);
        return res.send(`No logs found for ${fileName}!`);
      }

      const { path, stats } = matchingFile;

      // Get details about the file
      const lineCount = parseInt(await run('wc', ['-l', path]), 10);

      // Gather all the results into a single stream
      // @todo: tune this buffer so the highwatermark doesn't have to be so massive
      const data = new PassThrough({
        objectMode: true,
        highWaterMark: 1000000,
      });

      // Track if there will be more results after this
      let hasMore = false;

      // If the requested offset starts beyond the total
      // number of lines, return an empty array
      if (offset > lineCount) {
        data.push([]);
        data.end();
      } else {
        const tailUntil = limit + offset;
        const headUntil = Math.min(limit, lineCount - offset + 1);

        // If a query string is provided, grep against it
        const grepCommand = search ? `grep -i '${search}'` : 'cat';

        // Get lines from the log file
        const process = spawn('sh', [
          '-c',
          `tail -q -n ${tailUntil} ${join(LOG_PATH, file)} | ${grepCommand} | head -n ${headUntil}`,
        ]);

        hasMore = tailUntil + headUntil - 1 < lineCount;

        // Parse log entries from the tail stream
        await pipeline(
          process.stdout,
          createLineBuffer(),
          createLogTransform({
            stats,
          }),
          data,
        );
      }

      // Flatten the logs because they're currently chunked
      // into multiple arrays inside a larger array
      const logs = (await data.toArray()).flat();

      // If we have fewer logs than the limit, we don't have more
      hasMore = logs.length >= limit;

      // Add pagination data to the JSON response and
      // pipe it to the response stream
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(createResponseBody({ hasMore, logs, offset }));
    } catch (err) {
      console.error('Pipeline failed', err);
      res.status(500).send('Internal Server Error');
    }
  }
};
