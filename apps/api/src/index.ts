import express from 'express';
import { getFiles } from './files.js';
import { getLogHandles, pipeLogs } from './logs.js';

const app = express();
const port = 3000;

// Get a list of log files
app.get('/files', async (_req, { send }) => {
  send(await getFiles());
});

// Get logs
app.get<
  null,
  string,
  null,
  { fileName: string; limit: string; offset: string }
>('/logs', async (req, res) => {
  const { fileName } = req.query;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;
  const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
  const handles = await getLogHandles({ fileName });

  if (!handles?.length) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(404);
    return res.send('Log(s) not found');
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  await pipeLogs(handles, res, { limit, offset });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
