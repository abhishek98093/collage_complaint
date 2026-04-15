// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import LoadingPage from './LoadingPage';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { user, token, isAuthenticated } = useSelector((state) => state.user);

  useEffect(() => {
    const checkAccess = () => {
      // Get fresh data from localStorage as backup
      const localUserStr = localStorage.getItem('user');
      const localToken = localStorage.getItem('token');
      
      console.log('🔒 ProtectedRoute Check:', {
        reduxUser: user,
        reduxToken: token ? 'exists' : 'null',
        reduxAuth: isAuthenticated,
        localUser: localUserStr ? JSON.parse(localUserStr) : null,
        localToken: localToken ? 'exists' : 'null',
        allowedRoles
      });
      
      // Use localStorage as fallback if Redux state is empty
      let effectiveUser = user;
      let effectiveToken = token;
      let effectiveAuth = isAuthenticated;
      
      if ((!user || !token) && localUserStr && localToken) {
        try {
          effectiveUser = JSON.parse(localUserStr);
          effectiveToken = localToken;
          effectiveAuth = true;
          console.log('📦 Using localStorage fallback:', effectiveUser);
        } catch (error) {
          console.error('Error parsing localStorage user:', error);
        }
      }
      
      if (!effectiveAuth || !effectiveToken || !effectiveUser) {
        console.log('❌ Not authenticated, redirecting to landing page');
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }
      
      const userRole = effectiveUser?.role;
      console.log('👤 User role detected:', userRole);
      
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        console.log(`⛔ Role ${userRole} not allowed. Allowed: ${allowedRoles.join(', ')}`);
        setIsAuthorized(false);
        setIsChecking(false);
        return;
      }
      
      console.log('✅ Access granted for role:', userRole);
      setIsAuthorized(true);
      setIsChecking(false);
    };
    
    // Small delay to ensure Redux has rehydrated
    const timer = setTimeout(checkAccess, 100);
    return () => clearTimeout(timer);
  }, [user, token, isAuthenticated, allowedRoles]);

  if (isChecking) {
    return <LoadingPage status="load" message="Verifying access..." />;
  }

  if (!isAuthorized) {
    // Try to get role from localStorage for proper redirect
    let userRole = user?.role;
    if (!userRole) {
      try {
        const localUser = localStorage.getItem('user');
        if (localUser) {
          userRole = JSON.parse(localUser).role;
        }
      } catch (error) {
        console.error('Error getting role from localStorage:', error);
      }
    }
    
    console.log('🔄 Redirecting based on role:', userRole);
    
    if (userRole === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (userRole === 'user') {
      return <Navigate to="/user/dashboard" replace />;
    } else if (userRole === 'worker') {
      return <Navigate to="/worker/dashboard" replace />;
    }
    return <Navigate to="/landingpage" replace />;
  }

  return children;
};

export default ProtectedRoute;