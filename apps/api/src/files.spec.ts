import { test, expect } from 'vitest';
import { getFiles } from './files.js';

test('it loads a list of files, excluding non-syslog files', async () => {
  // Given
  // @todo: need to mock fs to return a fixed set of files

  // When
  const files = await getFiles();

  // Then
  expect(files).toMatchObject(
    expect.arrayContaining([
      expect.objectContaining({
        name: expect.any(String),
        path: expect.any(String),
        size: expect.any(Number),
      }),
    ]),
  );
});

test.todo(
  'it gets details for a specific file, returning nothing for non-existent files',
);
