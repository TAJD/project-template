import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { BottomTabBar } from './BottomTabBar';

describe('BottomTabBar', () => {
  it('only links to routes that exist in App.tsx', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );

    const home = screen.getByRole('link', { name: 'Home' }) as HTMLAnchorElement;
    const blog = screen.getByRole('link', { name: 'Blog' }) as HTMLAnchorElement;
    expect(home.getAttribute('href')).toBe('/');
    expect(blog.getAttribute('href')).toBe('/blog');
    expect(screen.queryByRole('link', { name: 'Explore' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull();
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
