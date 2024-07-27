import { expect, test } from 'vitest';
import { parseSyslog } from './parseSyslog.js';

test('it parses syslog lines into structured objects', async () => {
  // Given the six kinds of supports logs
  const iso8601Log =
    '2024-07-26T06:22:05.930Z hostname process[1234]: Adipisicing id veniam id elit consequat fugiat aliquip elit sit.';
  const dateWithOffsetLog =
    '2024-07-26 06:22:05.930-04:00 hostname process[1234]: Lorem incididunt non enim commodo do minim quis veniam qui id magna ut nisi.';
  const dateWithoutYearLog =
    'Jul 26 06:22:05 hostname process[1234]: Ex do excepteur dolore sit enim non dolor eu quis excepteur incididunt do dolor.';
  const dateWithoutYearWithDayLog =
    'Mon Jul 26 06:22:05 hostname process[1234]: Reprehenderit proident ex et sint nulla.';
  const dateWithYearAndOffsetLog =
    '2024-07-26 06:22:05-0400 hostname process[1234]: Occaecat minim irure nostrud deserunt nulla.';
  const dateWithYearLog =
    '2024-07-26 06:22:05 hostname process[1234]: Adipisicing nostrud ipsum do cupidatat.';

  // When
  const parsedIso8601Log = parseSyslog(iso8601Log, 2024);
  const parsedDateWithOffsetLog = parseSyslog(dateWithOffsetLog, 2024);
  const parsedDateWithoutYearLog = parseSyslog(dateWithoutYearLog, 2024);
  const parsedDateWithoutYearWithDayLog = parseSyslog(
    dateWithoutYearWithDayLog,
    2024,
  );
  const parsedDateWithYearAndOffsetLog = parseSyslog(
    dateWithYearAndOffsetLog,
    2024,
  );
  const parsedDateWithYearLog = parseSyslog(dateWithYearLog, 2024);

  // Then
  expect(parsedIso8601Log).toMatchObject({
    timestamp: '2024-07-26T06:22:05.930Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
  expect(parsedDateWithOffsetLog).toMatchObject({
    timestamp: '2024-07-26T10:22:05.930Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
  expect(parsedDateWithoutYearLog).toMatchObject({
    timestamp: '2024-07-26T10:22:05.000Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
  expect(parsedDateWithoutYearWithDayLog).toMatchObject({
    timestamp: '2024-07-26T10:22:05.000Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
  expect(parsedDateWithYearAndOffsetLog).toMatchObject({
    timestamp: '2024-07-26T10:22:05.000Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
  expect(parsedDateWithYearLog).toMatchObject({
    timestamp: '2024-07-26T10:22:05.000Z',
    host: 'hostname',
    process: 'process',
    pid: 1234,
    message: expect.any(String),
  });
});

test('it throws an error when unable to parse', async () => {
  // Given
  const trashLog = 'This is not a valid syslog entry';

  // When/Then
  expect(() => parseSyslog(trashLog)).toThrowError('Invalid syslog format!');
});
