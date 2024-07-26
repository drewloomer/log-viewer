import express from 'express';
import { getFiles } from './files.js';
import { pipeLogs } from './logs.js';

const app = express();
const port = 3000;

// Get a list of log files
app.get('/files', async (_req, res) => {
  res.send(await getFiles());
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

  // if (!processes?.length) {
  //   res.setHeader('Content-Type', 'text/plain');
  //   res.status(404);
  //   return res.send('Log(s) not found');
  // }

  res.setHeader('Content-Type', 'application/json');
  await pipeLogs(fileName, res, { limit, offset, search });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
