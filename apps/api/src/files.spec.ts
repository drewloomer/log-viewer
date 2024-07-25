import { test, expect } from 'vitest';
import { getFiles } from './files.js';

// @todo: need to mock fs to return a fixed set of files
test('it loads a list of files', async () => {
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
