import {
  Building2,
  CarFront,
  CircleUserRound,
  Flag,
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Plus,
  ScrollText,
  Store,
  Users,
  Wrench,
} from 'lucide-react';

export const PRIMARY_NAV_ITEMS = [
  {
    label: 'Cars',
    icon: CarFront,
    path: '/search?type=car',
    activePath: '/search',
    guestAllowed: true,
  },
  { label: 'Dealers', icon: Building2, path: '/dealers', guestAllowed: true },
  { label: 'Services', icon: Wrench, path: '/services', guestAllowed: true },
  {
    label: 'Sell',
    icon: Plus,
    path: '/post',
    guestAllowed: false,
    guestAction: 'sell a vehicle',
    prominent: true,
  },
  {
    label: 'Profile',
    icon: CircleUserRound,
    path: '/profile',
    guestAllowed: false,
    guestAction: 'manage your profile',
  },
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { label: 'Marketplace', icon: Store, path: '/admin/listings' },
  { label: 'Business applications', icon: Building2, path: '/admin/business-applications' },
  { label: 'Managed listings', icon: Megaphone, path: '/admin/managed-listings' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Reports', icon: Flag, path: '/admin/reports', countKey: 'reports' },
  { label: 'Support', icon: LifeBuoy, path: '/admin/support' },
  { label: 'Categories', icon: FolderTree, path: '/admin/categories' },
  { label: 'Audit Log', icon: ScrollText, path: '/admin/audit-log' },
];

export function isNavigationItemActive(pathname, itemPath, exact = false) {
  if (exact || itemPath === '/' || itemPath === '/admin') return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
