import { moduleRoutes, moduleNavLinks, headerSlot, bannerSlot } from './modules.config';

describe('modules.config', () => {
  it('registers every optional-module route the shell needs', () => {
    expect(moduleRoutes.map((route) => route.path)).toEqual([
      '/blog',
      '/blog/:slug',
      '/draft/:slug',
      '/tags/:tag',
      '/sign-up',
      '/sign-in',
      '/reset-password',
      '/reset-password/:token',
      '/dev/mailbox',
      '/settings',
      '/pricing',
      '/members',
    ]);
  });

  it('registers nav links, flagging only Blog for the bottom tab bar', () => {
    expect(moduleNavLinks).toEqual([
      { to: '/blog', label: 'Blog', bottomTab: true },
      { to: '/members', label: 'Members' },
    ]);
  });

  it('registers exactly one header slot and one banner slot', () => {
    expect(headerSlot).toHaveLength(1);
    expect(bannerSlot).toHaveLength(1);
  });
});
