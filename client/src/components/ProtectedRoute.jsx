import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role check if needed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

export default ProtectedRoute;
