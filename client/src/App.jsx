import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';

// Dev B Pages
import AssetRegistration from './pages/Assets/AssetRegistration';
import AssetDirectory from './pages/Assets/AssetDirectory';
import AssetDetail from './pages/Assets/AssetDetail';
import BookingPage from './pages/Bookings/BookingPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import NotificationBell from './components/NotificationBell';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Simple Demo Navbar */}
        <nav className="bg-indigo-600 text-white p-4 shadow-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold">AssetFlow (Dev B Demo)</h1>
            <div className="space-x-4 flex items-center">
              <Link to="/dashboard" className="hover:text-indigo-200 mr-2">Dashboard</Link>
              <Link to="/assets" className="hover:text-indigo-200">Asset Directory</Link>
              <Link to="/assets/register" className="hover:text-indigo-200">Register Asset</Link>
              <Link to="/bookings" className="hover:text-indigo-200">Bookings</Link>
              <NotificationBell />
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            <Route path="/dashboard" element={<DashboardPage />} />
            
            {/* Asset Routes */}
            <Route path="/assets" element={<AssetDirectory />} />
            <Route path="/assets/register" element={<AssetRegistration />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
            
            {/* Booking Routes */}
            <Route path="/bookings" element={<BookingPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
