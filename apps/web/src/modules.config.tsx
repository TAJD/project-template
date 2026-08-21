import type { ReactElement, ComponentType } from 'react';
import { BlogListPage, BlogPostPage, DraftPostPage, TagPage } from './modules/blog';
import {
  SignInPage,
  SignUpPage,
  ResetRequestPage,
  ResetPage,
  DevMailboxPage,
  SettingsPage,
  UserMenu,
  VerifyPromptBanner,
} from './modules/account';
import { PricingPage, GatedSamplePage } from './modules/billing';

// This file is the only place in the shell (App.tsx, Layout.tsx,
// BottomTabBar.tsx) allowed to import from an optional module. Deleting a
// module means: delete its directory, then delete its entries here.

export interface ModuleRoute {
  path: string;
  element: ReactElement;
}

export interface ModuleNavLink {
  to: string;
  label: string;
  /** Also render this link in the mobile bottom tab bar. */
  bottomTab?: boolean;
}

export const moduleRoutes: ModuleRoute[] = [
  { path: '/blog', element: <BlogListPage /> },
  { path: '/blog/:slug', element: <BlogPostPage /> },
  { path: '/draft/:slug', element: <DraftPostPage /> },
  { path: '/tags/:tag', element: <TagPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/reset-password', element: <ResetRequestPage /> },
  { path: '/reset-password/:token', element: <ResetPage /> },
  { path: '/dev/mailbox', element: <DevMailboxPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/pricing', element: <PricingPage /> },
  // Members is in the main nav (rather than reached only via pricing/account)
  // because it's the deliberate account+billing proof surface (PT-15) — it
  // should be one click away for anyone checking the example site still
  // works, not buried.
  { path: '/members', element: <GatedSamplePage /> },
];

export const moduleNavLinks: ModuleNavLink[] = [
  { to: '/blog', label: 'Blog', bottomTab: true },
  { to: '/members', label: 'Members' },
];

// Zero-prop components rendered in fixed shell slots — see Layout.tsx.
export const headerSlot: ComponentType[] = [UserMenu];
export const bannerSlot: ComponentType[] = [VerifyPromptBanner];
