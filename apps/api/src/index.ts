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
app.get<null, string, null, { fileName: string }>('/logs', async (req, res) => {
  const handles = await getLogHandles({ fileName: req.query.fileName });

  if (!handles?.length) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(404);
    return res.send('Log(s) not found');
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');
  await pipeLogs(handles, res);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
