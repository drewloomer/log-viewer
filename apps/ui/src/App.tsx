/* eslint-disable react/react-in-jsx-scope */
import { useState } from 'react';
import './App.css';
import { FilePicker } from './FilePicker';
import type { File } from '../../api/src/models';
import { LogViewer } from './LogViewer';

function App() {
  const [activeFile, setActiveFile] = useState<File>();
  const [search, setSearch] = useState<string>();
  const handleFileChange: Parameters<typeof FilePicker>[0]['onChange'] = (
    file,
    search,
  ) => {
    setActiveFile(file);
    setSearch(search);
  };

  return (
    <div>
      <h1>Log Viewer</h1>
      <FilePicker onChange={handleFileChange} />
      <LogViewer file={activeFile} search={search} />
    </div>
  );
}

export default App;
