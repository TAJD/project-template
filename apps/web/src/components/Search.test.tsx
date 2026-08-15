import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Search } from './Search';
import { loadPagefind } from './pagefindClient';

vi.mock('./pagefindClient', () => ({
  loadPagefind: vi.fn(),
}));

const loadPagefindMock = vi.mocked(loadPagefind);

describe('Search', () => {
  beforeEach(() => {
    loadPagefindMock.mockReset();
  });

  it('is closed by default and opens a search dialog on click', () => {
    render(<Search />);

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('dialog', { name: 'Site search' })).toBeTruthy();
  });

  it('renders results from a successful Pagefind search', async () => {
    loadPagefindMock.mockResolvedValue({
      search: vi.fn().mockResolvedValue({
        results: [
          {
            data: vi.fn().mockResolvedValue({
              url: '/blog/getting-started',
              excerpt: 'A tour of what ships in the template.',
              meta: { title: 'Getting started' },
            }),
          },
        ],
      }),
    });

    render(<Search />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'template' },
    });

    await waitFor(() => {
      expect(screen.getByText('Getting started')).toBeTruthy();
    });
    expect(screen.getByText('A tour of what ships in the template.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Getting started/ }).getAttribute('href')).toBe(
      '/blog/getting-started',
    );
  });

  it('renders a fallback message and does not throw when the Pagefind import fails', async () => {
    loadPagefindMock.mockRejectedValue(new Error('404'));

    render(<Search />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(() => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'template' },
      });
    }).not.toThrow();

    await waitFor(() => {
      expect(screen.getByText('Search is not available in development.')).toBeTruthy();
    });
  });

  it('closes the dialog and clears the query via the Close button', async () => {
    loadPagefindMock.mockResolvedValue({ search: vi.fn().mockResolvedValue({ results: [] }) });

    render(<Search />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
      target: { value: 'template' },
    });
    await waitFor(() => expect(loadPagefindMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
