// components/HomeRedirect.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingPage from './LoadingPage';

const HomeRedirect = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const { user, token, isAuthenticated } = useSelector((state) => state.user);

  useEffect(() => {
    const checkAuthAndRedirect = () => {
      // Get fresh data from localStorage
      const localUserStr = localStorage.getItem('user');
      const localToken = localStorage.getItem('token');
      
      console.log('🏠 HomeRedirect Check:', {
        reduxUser: user,
        reduxToken: token ? 'exists' : 'null',
        reduxAuth: isAuthenticated,
        localUser: localUserStr ? JSON.parse(localUserStr) : null,
        localToken: localToken ? 'exists' : 'null'
      });
      
      // Use localStorage as fallback
      let effectiveUser = user;
      let effectiveToken = token;
      let effectiveAuth = isAuthenticated;
      
      if ((!user || !token) && localUserStr && localToken) {
        try {
          effectiveUser = JSON.parse(localUserStr);
          effectiveToken = localToken;
          effectiveAuth = true;
          console.log('📦 Using localStorage fallback in HomeRedirect:', effectiveUser);
        } catch (error) {
          console.error('Error parsing localStorage user:', error);
        }
      }
      
      if (!effectiveAuth || !effectiveToken || !effectiveUser) {
        console.log('❌ No valid auth, redirecting to landing page');
        navigate('/landingpage', { replace: true });
        setIsChecking(false);
        return;
      }
      
      const role = effectiveUser?.role;
      console.log('🎯 Redirecting based on role:', role);
      
      switch (role) {
        case 'admin':
          console.log('➡️ Redirecting to admin dashboard');
          navigate('/admin/dashboard', { replace: true });
          break;
        case 'user':
          console.log('➡️ Redirecting to user dashboard');
          navigate('/user/dashboard', { replace: true });
          break;
        case 'worker':
          console.log('➡️ Redirecting to worker dashboard');
          navigate('/worker/dashboard', { replace: true });
          break;
        default:
          console.log('⚠️ Unknown role, redirecting to landing page');
          navigate('/landingpage', { replace: true });
      }
      setIsChecking(false);
    };
    
    // Small delay to ensure everything is loaded
    const timer = setTimeout(checkAuthAndRedirect, 100);
    return () => clearTimeout(timer);
  }, [navigate, user, token, isAuthenticated]);

  if (isChecking) {
    return <LoadingPage status="load" message="Redirecting to your dashboard..." />;
  }
  
  return null;
};

export default HomeRedirect;