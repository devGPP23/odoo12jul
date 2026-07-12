import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, Settings } from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="flex w-64 flex-col bg-white shadow-md">
      <div className="flex h-16 items-center justify-center border-b border-gray-100">
        <h1 className="text-xl font-bold text-blue-600 tracking-tight">AssetFlow</h1>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-4 py-3 font-medium transition-colors ${
              isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
            }`
          }
        >
          <LayoutDashboard size={20} />
          Dashboard
        </NavLink>
        {/* More links will go here in Phase 4 */}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">{user?.name}</span>
            <span className="text-xs text-gray-500">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
