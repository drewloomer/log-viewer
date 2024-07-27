/* eslint-disable react/react-in-jsx-scope */
import {
  ChangeEventHandler,
  FormEventHandler,
  PropsWithChildren,
  useEffect,
  useState,
} from 'react';
import type { File } from '../../api/src/models';

const sizeFormatter = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 2,
});

const useFiles = () => {
  const [error, setError] = useState<Error>();
  const [files, setFiles] = useState<{ data: File[] }>({ data: [] });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:3000/files')
      .then(async (res) => {
        setFiles(await res.json());
        setLoaded(true);
      })
      .catch((err) => {
        setError(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { error, files, loaded, loading };
};

export const FilePicker = ({
  onChange,
}: PropsWithChildren<{ onChange: (file?: File, search?: string) => void }>) => {
  const {
    error,
    files: { data },
    loading,
  } = useFiles();
  const [selected, setSelected] = useState<File>();
  const [searchValue, setSearchValue] = useState<string>();

  const handleSelectChange: ChangeEventHandler<HTMLSelectElement> = (e) => {
    const newSelected = data?.find((file) => file.name === e.target.value);
    setSelected(newSelected);
    onChange(newSelected, searchValue);
  };

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setSearchValue(e.target.value);
  };

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    onChange(selected, searchValue);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Uh oh. {error.message}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="filepicker">
      <select
        onChange={handleSelectChange}
        value={selected?.name}
        className="filepicker__select"
      >
        <option value="">- Choose a file -</option>
        {data.map(({ name, path, stats }) => (
          <option key={name} value={name}>
            {path} ({sizeFormatter.format(stats.size / 1024)} KB)
          </option>
        ))}
      </select>
      <div className="filepicker__search">
        <input
          onChange={handleSearchChange}
          value={searchValue}
          placeholder="Text to search"
          className="filepicker__search-input"
        />
        <button>Go</button>
      </div>
    </form>
  );
};
