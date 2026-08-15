import { useEffect, useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { loadPagefind } from './pagefindClient';

type ResultItem = { url: string; title: string; excerpt: string };
type Status = 'idle' | 'unavailable';

export function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  async function runSearch(value: string) {
    setQuery(value);
    if (!value) {
      setResults([]);
      setStatus('idle');
      return;
    }

    try {
      const pagefind = await loadPagefind();
      const { results: rawResults } = await pagefind.search(value);
      const data = await Promise.all(rawResults.map((result) => result.data()));
      setResults(
        data.map((entry) => ({
          url: entry.url,
          title: entry.meta.title ?? entry.url,
          excerpt: entry.excerpt,
        })),
      );
      setStatus('idle');
    } catch {
      // Pagefind's index (dist/pagefind/) only exists after a production
      // build — in dev, or a build where indexing didn't run, the dynamic
      // import 404s or throws. Degrade to a message instead of crashing.
      setStatus('unavailable');
      setResults([]);
    }
  }

  function close() {
    setOpen(false);
    setQuery('');
    setResults([]);
    setStatus('idle');
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="rounded-md border border-rule px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Search
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; Escape (handled above) covers keyboard users
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site search"
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/50 p-4 pt-20"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-rule bg-paper p-4 text-ink shadow-lg">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Search"
                  name="search"
                  value={query}
                  onChange={(event) => void runSearch(event.target.value)}
                  placeholder="Search the site..."
                />
              </div>
              <Button type="button" variant="secondary" onClick={close}>
                Close
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {status === 'unavailable' && (
                <p className="text-sm text-muted">Search is not available in development.</p>
              )}
              {status === 'idle' && query && results.length === 0 && (
                <p className="text-sm text-muted">No results found.</p>
              )}
              {results.map((result) => (
                <a
                  key={result.url}
                  href={result.url}
                  className="block rounded-md border border-rule p-3 hover:bg-elev"
                >
                  <p className="font-medium">{result.title}</p>
                  <p className="text-sm text-muted">{result.excerpt}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
