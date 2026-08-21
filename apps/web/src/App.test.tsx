import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import App from './App';

describe('Home route', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the site name', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Exemplar' })).toBeTruthy();
  });
});
