import express from 'express';
import cors from 'cors';
import { getFiles } from './files.js';
import { pipeLogs } from './logs.js';
import type { File, ApiResponse } from './models.js';

const app = express();
const port = 3000;

// 🤫
app.use(cors());

// Get a list of log files
app.get('/files', async (_req, res) => {
  const data = await getFiles();
  const response: ApiResponse<File[]> = {
    data,
    meta: { count: data.length },
  };
  res.send(response);
});

// Get logs
app.get<
  null,
  string,
  null,
  { fileName: string; limit?: string; offset?: string; search?: string }
>('/logs', async (req, res) => {
  const { fileName, search } = req.query;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
  await pipeLogs(fileName, res, { limit, offset, search });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
