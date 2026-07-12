import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<div className="p-8">404 - Not Found</div>} />
    </Routes>
  );
}

export default App;
