import { faker } from '@faker-js/faker';
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = 'dist';
const FILE_COUNT = process.argv[2] || 5;
const MAX_FILE_SIZE = 1e9; // 1GB

const setupOutDir = async () => {
  console.log(`Cleaning ${OUT_DIR} directory...`);
  await rm(OUT_DIR, { recursive: true });
  await mkdir('dist', { recursive: true });
};

const generateLog = (time: Date) => {
  return `${time.toISOString()} ${faker.internet.ip()} ${faker.lorem.word()}[${faker.number.int({ min: 1000, max: 100000 })}]: ${faker.lorem.paragraph()} \n`;
};

const generateFile = async () => {
  const fileName = resolve(OUT_DIR, faker.system.commonFileName('log'));
  console.log(`🪶 Generating ${fileName}...`);

  const fileStream = createWriteStream(resolve(OUT_DIR, fileName));

  let lastTime = faker.date.recent();
  let currentSize = 0;
  let index = 0;

  function writeNext() {
    while (index < 10000000000) {
      lastTime = new Date(
        lastTime.getTime() - faker.number.int({ min: 10, max: 1000 }),
      );
      const line = generateLog(lastTime);
      const lineSize = Buffer.byteLength(line);

      if (currentSize + lineSize > MAX_FILE_SIZE) {
        break;
      }

      currentSize += lineSize;
      const canWrite = fileStream.write(line);

      if (!canWrite) {
        fileStream.once('drain', writeNext);
        return;
      }

      index++;
    }

    fileStream.end(() => {
      console.log(`🪄 Generated ${fileName}!`);
    });
  }

  writeNext();

  fileStream.on('error', (err) => {
    console.error(`🚨 Error writing to ${fileName}:`, err);
  });
};

const generateFiles = async () => {
  console.log(`Generating ${FILE_COUNT} files... This could take a few minutes. ☕️`);
  await Promise.all(new Array(FILE_COUNT).fill('').map(generateFile));
};

await setupOutDir();
await generateFiles();
