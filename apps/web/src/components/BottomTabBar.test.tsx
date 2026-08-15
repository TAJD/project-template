import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BottomTabBar } from './BottomTabBar';

describe('BottomTabBar', () => {
  it('renders the placeholder tabs', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explore' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profile' })).toBeTruthy();
  });

  it('is hidden on desktop via a responsive utility class', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'Primary' }).className).toMatch(/md:hidden/);
  });
});
