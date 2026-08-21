import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { BlogListPage, BlogPostPage, DraftPostPage, TagPage } from './index';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/draft/:slug" element={<DraftPostPage />} />
        <Route path="/tags/:tag" element={<TagPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('blog routes', () => {
  it('lists published posts on /blog but not the draft', () => {
    renderAt('/blog');

    expect(screen.getByText('Getting started with the template')).toBeTruthy();
    expect(screen.queryByText('A draft post in progress')).toBeNull();
  });

  it('renders a published post at /blog/:slug', () => {
    renderAt('/blog/getting-started-with-the-template');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Getting started with the template' }),
    ).toBeTruthy();
  });

  it('shows not-found for a draft slug at /blog/:slug', () => {
    renderAt('/blog/a-draft-post-in-progress');

    expect(screen.getByText('Post not found')).toBeTruthy();
  });

  it('shows not-found for an unknown slug at /blog/:slug', () => {
    renderAt('/blog/does-not-exist');

    expect(screen.getByText('Post not found')).toBeTruthy();
  });

  it('serves the draft post at /draft/:slug', () => {
    renderAt('/draft/a-draft-post-in-progress');

    expect(
      screen.getByRole('heading', { level: 1, name: 'A draft post in progress' }),
    ).toBeTruthy();
    expect(screen.getByText('Draft preview')).toBeTruthy();
  });

  it('lists posts filtered by tag', () => {
    renderAt('/tags/seo');

    expect(screen.getByText('Structured data without the headache')).toBeTruthy();
    expect(screen.queryByText('Getting started with the template')).toBeNull();
  });
});
