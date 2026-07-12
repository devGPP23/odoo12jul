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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Routes (Needs Layout and Sidebar) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Only ADMIN can access Org Setup */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/org-setup" element={<OrgSetup />} />
              </Route>
              
              {/* All feature routes */}
              <Route path="/assets" element={<div>Assets Page (Dev B)</div>} />
              <Route path="/allocations" element={<Allocations />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/audits" element={<div>Audits Page</div>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
