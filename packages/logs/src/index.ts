import { faker } from '@faker-js/faker';
import { mkdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = 'dist';
const FILES: [string, number][] = [
  ['small', 10],
  ['medium', 100],
  ['large', 1000],
];

const setupOutDir = async () => {
  console.log(`Cleaning ${OUT_DIR} directory...`);
  await rm(OUT_DIR, { recursive: true });
  await mkdir('dist', { recursive: true });
};

const generateLog = (time: Date) => {
  return `${time.toISOString()} ${faker.internet.ip()} ${faker.lorem.word()}[${faker.number.int({ min: 1000, max: 100000 })}]: ${faker.lorem.paragraph()} \n`;
};

const generateFile = async ([name, size]: [string, number]) =>
  new Promise<void>((res, rej) => {
    const fileName = resolve(OUT_DIR, `${name}.log`);
    const fileSize = size * 1024 * 1024;
    console.log(`🪶 Generating ${fileName}...`);

    const fileStream = createWriteStream(resolve(OUT_DIR, fileName));

    let lastTime = faker.date.recent();
    let currentSize = 0;

    const writeNext = () => {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Logs need to be in descending order, so we add a random number of milliseconds to each line
        lastTime = new Date(
          lastTime.getTime() + faker.number.int({ min: 10, max: 1000 }),
        );

        const line = generateLog(lastTime);
        const lineSize = Buffer.byteLength(line);

        // If the next line would exceed the file size, stop writing
        if (currentSize + lineSize > fileSize) {
          fileStream.end(() => {
            console.log(`🪄 Generated ${fileName}!`);
            res();
          });
          break;
        }

        currentSize += lineSize;
        const canWrite = fileStream.write(line);

        // If the stream is full, wait for the drain event before writing more
        if (!canWrite) {
          fileStream.once('drain', writeNext);
          return;
        }
      }
    };

    writeNext();

    fileStream.on('error', (err) => {
      console.error(`🚨 Error writing to ${fileName}:`, err);
      rej(err);
    });
  });

const generateFiles = async () => {
  console.log(
    `Generating ${FILES.length} files... This could take a few minutes. ☕️`,
  );
  await Promise.all(FILES.map(generateFile));
};

const generateNumberList = async () => {
  console.log(
    'Generating number list for easier testing of finding by range...',
  );
  const fileName = resolve(OUT_DIR, 'numbers.txt');
  const fileStream = createWriteStream(resolve(OUT_DIR, fileName));
  for (let i = 0; i < 5000; i++) {
    const canWrite = fileStream.write(`${i}\n`);
    if (!canWrite) {
      await new Promise((res) => fileStream.once('drain', res));
    }
  }
  fileStream.end();
};

await setupOutDir();
await generateNumberList();
await generateFiles();
