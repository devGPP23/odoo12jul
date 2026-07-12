import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.name}. You are logged in as {user?.role}.
        </p>
      </header>
      
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
        Phase 0 complete. System is ready for feature development.
      </div>
    </div>
  );
};

export default Dashboard;
