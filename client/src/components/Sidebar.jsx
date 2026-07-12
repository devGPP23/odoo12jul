import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, CalendarCheck, ArrowLeftRight,
  Wrench, ClipboardCheck, Bell, Activity, BarChart3,
  Settings, LogOut
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Assets', path: '/assets', icon: Package, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Allocations', path: '/allocations', icon: ArrowLeftRight, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Bookings', path: '/bookings', icon: CalendarCheck, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Maintenance', path: '/maintenance', icon: Wrench, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Audits', path: '/audits', icon: ClipboardCheck, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD'] },
    { name: 'Notifications', path: '/notifications', icon: Bell, roles: ['ADMIN', 'ASSET_MANAGER', 'DEPT_HEAD', 'EMPLOYEE'] },
    { name: 'Activity Logs', path: '/activity-logs', icon: Activity, roles: ['ADMIN', 'ASSET_MANAGER'] },
    { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'ASSET_MANAGER'] },
    { name: 'Org Setup', path: '/org-setup', icon: Settings, roles: ['ADMIN'] },
  ];

  const visibleLinks = links.filter(link =>
    user ? link.roles.includes(user.role) : false
  );

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col shadow-sm">
      {/* Brand */}
      <div className="p-5 border-b border-gray-100">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-lg flex items-center justify-center shadow-md">
            <Package size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
            AssetFlow
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleLinks.map((link) => {
          const isActive = location.pathname === link.path || 
            (link.path !== '/dashboard' && location.pathname.startsWith(link.path));
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-gray-400'} />
              {link.name}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      {user && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role.replace(/_/g, ' ').toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full text-left text-sm text-red-600 hover:text-red-700 hover:bg-red-50 font-medium px-2 py-1.5 rounded-md transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
