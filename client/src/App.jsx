import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import OrgSetup from './pages/OrgSetup/OrgSetup'
import Maintenance from './pages/Maintenance/Maintenance'
import Allocations from './pages/Allocations/Allocations'
import Audits from './pages/Audits/Audits'

// Dev B Pages
import AssetRegistration from './pages/Assets/AssetRegistration'
import AssetDirectory from './pages/Assets/AssetDirectory'
import AssetDetail from './pages/Assets/AssetDetail'
import BookingPage from './pages/Bookings/BookingPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import NotificationsPage from './pages/Notifications/NotificationsPage'
import ActivityLogPage from './pages/ActivityLog/ActivityLogPage'
import ReportsPage from './pages/Reports/ReportsPage'

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
              
              {/* Org Setup - Admin Only */}
              <Route path="/org-setup" element={<OrgSetup />} />
              
              {/* Asset Routes */}
              <Route path="/assets" element={<AssetDirectory />} />
              <Route path="/assets/register" element={<AssetRegistration />} />
              <Route path="/assets/:id" element={<AssetDetail />} />

              {/* Allocation & Transfer */}
              <Route path="/allocations" element={<Allocations />} />

              {/* Bookings */}
              <Route path="/bookings" element={<BookingPage />} />

              {/* Maintenance */}
              <Route path="/maintenance" element={<Maintenance />} />

              {/* Audits */}
              <Route path="/audits" element={<Audits />} />

              {/* Notifications & Logs */}
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/activity-logs" element={<ActivityLogPage />} />
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
