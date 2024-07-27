import { test, expect, vi } from 'vitest';
import { getFile, getFiles } from './files.js';

vi.mock('node:fs/promises', () => {
  return {
    readdir: async () => ['file1.log', 'file2.log', 'file3.txt'],
    stat: async () => ({ size: 1234 }),
  };
});

test('it loads a list of files, excluding non-syslog files', async () => {
  // Given
  // mock set above

  // When
  const files = await getFiles();

  // Then
  expect(files).toHaveLength(2);
  expect(files).toMatchObject(
    expect.arrayContaining([
      expect.objectContaining({
        name: expect.stringMatching(/file\d\.log/),
        path: expect.stringMatching(/\/var\/log\/file\d\.log/),
        stats: expect.objectContaining({
          size: 1234,
        }),
      }),
    ]),
  );
});

test('it gets details for a specific file, returning nothing for non-existent files', async () => {
  // Given
  // mock set above

  // When
  const file = await getFile('file1.log');
  const notAllowed = await getFile('file3.txt');
  const noFile = await getFile('file4.log');

  // Then
  expect(file).toMatchObject({
    name: 'file1.log',
    path: '/var/log/file1.log',
    stats: expect.objectContaining({
      size: 1234,
    }),
  });
  expect(notAllowed).toBeUndefined();
  expect(noFile).toBeUndefined();
});
