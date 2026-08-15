import { describe, expect, it } from 'vitest';
import { slugForPath } from './generate-og.mjs';

describe('slugForPath', () => {
  it('maps the home route to "home"', () => {
    expect(slugForPath('/')).toBe('home');
  });

  it('sanitizes nested paths into a single hyphenated slug', () => {
    expect(slugForPath('/blog/my-post')).toBe('blog-my-post');
  });
});
