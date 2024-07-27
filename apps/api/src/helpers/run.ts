import { spawn } from 'node:child_process';

/**
 * Await a shell command and return the output as a string.
 */
export const run = async (...cmd: [string, Parameters<typeof spawn>[1]]) =>
  new Promise<string>((res, rej) => {
    const proc = spawn(...cmd);
    let result = '';
    proc.stdout?.on('data', function (data) {
      result += data.toString();
    });
    proc.on('error', (err) => rej(err));
    proc.on('close', function () {
      return res(result);
    });
  });
