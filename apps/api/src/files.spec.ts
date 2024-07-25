import { test, expect } from 'vitest';
import { getFiles } from './files.js';

test('it loads a list of files', async () => {
  // Given

  // When
  const files = await getFiles();
  console.log(files);

  // Then
  expect(files).toMatchObject(
    expect.arrayContaining([
      expect.objectContaining({
        name: expect.any(String),
      }),
    ]),
  );
});
