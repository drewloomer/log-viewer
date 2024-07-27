import type { Stats } from 'node:fs';

export type File = {
  name: string;
  path: string;
  stats: Stats;
};

export type Log = {
  host?: string;
  message: string;
  pid?: number;
  process?: string;
  timestamp?: string;
};

export type Meta = {
  count: number;
  from?: number;
  next?: number;
  to?: number;
};

export interface ApiResponse<T extends object = object> {
  data: T;
  meta: Meta;
}
