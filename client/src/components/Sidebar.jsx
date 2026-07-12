import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // define links based on role
  const links = [
    { name: 'Dashboard', path: '/dashboard', roles: ['admin', 'assetManager', 'deptHead', 'employee'] },
    { name: 'Assets', path: '/assets', roles: ['admin', 'assetManager', 'deptHead', 'employee'] },
    { name: 'Bookings', path: '/bookings', roles: ['admin', 'assetManager', 'deptHead', 'employee'] },
    { name: 'Org Setup', path: '/org-setup', roles: ['admin'] },
    { name: 'Reports', path: '/reports', roles: ['admin', 'assetManager'] },
  ];

  // filter links the current user is allowed to see
  const visibleLinks = links.filter(link => 
    !user ? false : link.roles.includes(user.role === 'asset_manager' ? 'assetManager' : user.role === 'dept_head' ? 'deptHead' : user.role)
  );

  return (
    <aside className="w-64 bg-white border-r h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-indigo-600">AssetFlow</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {visibleLinks.map((link) => {
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`block px-4 py-2 rounded-md transition-colors ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="p-4 border-t">
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
