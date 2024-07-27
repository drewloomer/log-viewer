/* eslint-disable react/react-in-jsx-scope */
import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import type { File, Log, Meta } from '../../api/src/models';

const useLogs = (file?: File, search?: string) => {
  const [error, setError] = useState<Error>();
  const [logs, setLogs] = useState<{ data: Log[]; meta: Meta }>();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [aggregatedLogs, setAggregatedLogs] = useState<Log[]>([]);
  const fileRef = useRef(file);
  const searchRef = useRef(search);

  useEffect(() => {
    if (fileRef.current !== file || searchRef.current !== search) {
      setAggregatedLogs([]);
    }

    if (!file) {
      return;
    }

    setLoading(true);

    const url = new URL('http://localhost:3000/logs');
    url.searchParams.set('fileName', file.name);
    url.searchParams.set('limit', '100');
    url.searchParams.set('offset', offset.toString());
    if (search) {
      url.searchParams.set('search', search);
    }
    fetch(url)
      .then(async (res) => {
        const logs = await res.json();
        setLogs(logs);
        setAggregatedLogs((prev) => [...prev, ...logs.data]);
        setLoaded(true);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
        fileRef.current = file;
        searchRef.current = search;
      });
  }, [file, offset, search]);

  return { aggregatedLogs, error, logs, loaded, loading, setOffset };
};

const dateFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

export const LogViewer = ({
  file,
  search,
}: PropsWithChildren<{ file?: File; search?: string }>) => {
  const { error, logs, loaded, loading, setOffset } = useLogs(file, search);

  const handleLoadMore = () => {
    if (logs?.meta.next) {
      setOffset(logs?.meta.next);
    }
  };

  if (error) {
    return <div>Uh oh. {error.message}</div>;
  }

  if (!loaded) {
    return <div>Select a log to view.</div>;
  }

  if (!logs || !logs.data.length) {
    return <div>No logs found</div>;
  }

  const { data, meta } = logs;

  return (
    <>
      <h2 className="logfile">
        <pre>
          <code>{file?.name}</code>
        </pre>
      </h2>
      <div className="logs">
        {data.map(({ message, timestamp, process, pid }, i) => {
          const date = timestamp ? new Date(timestamp) : undefined;
          return (
            <div key={i} className="logs__log">
              {date && (
                <h3 title={timestamp} className="logs__timestamp">
                  {dateFormat.format(date)}
                </h3>
              )}
              <p className="logs__message">{message}</p>
              <aside className="logs__process">
                {process} <small>{pid}</small>
              </aside>
            </div>
          );
        })}
      </div>
      {meta.next && (
        <button onClick={handleLoadMore} disabled={loading}>
          Load More
        </button>
      )}
      {loading && <div>Loading...</div>}
    </>
  );
};
