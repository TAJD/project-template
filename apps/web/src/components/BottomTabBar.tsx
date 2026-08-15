import { NavLink } from 'react-router';

const tabs = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/profile', label: 'Profile' },
];

export function BottomTabBar() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 flex border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center py-2 text-sm ${isActive ? 'text-accent' : 'text-muted'}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
