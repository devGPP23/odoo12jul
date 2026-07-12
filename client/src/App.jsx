import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import OrgSetup from './pages/OrgSetup/OrgSetup'
import Maintenance from './pages/Maintenance/Maintenance'
import Allocations from './pages/Allocations/Allocations'
import Bookings from './pages/Bookings/Bookings'
import Audits from './pages/Audits/Audits'

// Dev B Pages
import AssetRegistration from './pages/Assets/AssetRegistration'
import AssetDirectory from './pages/Assets/AssetDirectory'
import AssetDetail from './pages/Assets/AssetDetail'
import BookingPage from './pages/Bookings/BookingPage'
import DashboardPage from './pages/Dashboard/DashboardPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              
              {/* Admin Only */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/org-setup" element={<OrgSetup />} />
              </Route>
              
              {/* Asset Routes (Dev B) */}
              <Route path="/assets" element={<AssetDirectory />} />
              <Route path="/assets/register" element={<AssetRegistration />} />
              <Route path="/assets/:id" element={<AssetDetail />} />

              {/* Allocation & Transfer (Dev A - Nishant/Om) */}
              <Route path="/allocations" element={<Allocations />} />

              {/* Bookings (Dev B - GP) */}
              <Route path="/bookings" element={<BookingPage />} />

              {/* Maintenance (Dev A - Nishant) */}
              <Route path="/maintenance" element={<Maintenance />} />

              <Route path="/audits" element={<Audits />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
