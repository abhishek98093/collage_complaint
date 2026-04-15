// App.jsx - WITH Router (only one Router in the app)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import HomeRedirect from './components/HomeRedirect';
import ProtectedRoute from './components/ProtectedRoute';
import TokenExpiryChecker from './components/TokenExpiryChecker';
import About from './pages/About';

// Separate component that uses useLocation
function AppContent() {
  const location = useLocation();
  const shouldApplyMargin = location.pathname !== '/landingpage';

  return (
    <div className="min-h-screen flex flex-col">
      <TokenExpiryChecker />
      <Navbar />
      <div className={`flex-grow ${shouldApplyMargin ? 'mt-16' : ''}`}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/landingpage" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/about" element={<About />} />
          
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/user/dashboard" element={
            <ProtectedRoute allowedRoles={['user']}>
              <UserDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/worker/dashboard" element={
            <ProtectedRoute allowedRoles={['worker']}>
              <WorkerDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

// Main App component with Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;