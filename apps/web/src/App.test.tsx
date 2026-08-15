import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import App from './App';

describe('Home route', () => {
  it('renders the site name', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByText('Exemplar')).toBeTruthy();
  });
});
