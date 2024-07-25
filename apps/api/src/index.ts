import express from 'express';
import { getFiles } from './files.js';

const app = express();
const port = 3000;

// Get a list of log files
app.get('/files', async (_req, res) => {
  res.send(await getFiles());
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
