import { readdir, stat } from 'node:fs/promises';
import { parse, join } from 'node:path';
import { LOG_PATH } from './consts.js';

export type File = {
  name: string;
  path: string;
  size: number;
};

export const getFiles = async () => {
  const files = await readdir(LOG_PATH, { recursive: true });
  const validFiles: File[] = [];

  for (const file of files) {
    const { base: name, ext } = parse(file);
    const path = join(LOG_PATH, file);

    // Only deal with log files, not other formats
    if (ext === '.log') {
      const { size } = await stat(path);
      validFiles.push({
        name,
        path,
        size,
      });
    }
  }

  return validFiles;
};
