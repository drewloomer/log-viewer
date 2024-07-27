import { readdir, stat } from 'node:fs/promises';
import { parse, join } from 'node:path';
import { LOG_PATH } from './consts.js';
import type { File } from './models.js';

export const getFiles = async () => {
  const files = await readdir(LOG_PATH, { recursive: true });
  const validFiles: File[] = [];

  for (const file of files) {
    const { base: name, ext } = parse(file);
    const path = join(LOG_PATH, file);

    // Only deal with log files, not other formats
    if (ext === '.log') {
      const stats = await stat(path);
      validFiles.push({
        name,
        path,
        stats,
      });
    }
  }

  return validFiles.sort((a, b) => (b.path > a.path ? -1 : 1));
};

export const getFile = async (fileName: string) => {
  const files = await getFiles();
  return files.find(({ name }) => name === fileName);
};
