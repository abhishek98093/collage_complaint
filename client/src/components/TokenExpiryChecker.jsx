import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { resetUser } from '../slices/userSlice';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';

const PUBLIC_ROUTES = ['/', '/landingpage', '/login', '/signup', '/about'];

const TokenExpiryChecker = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useSelector((state) => state.user);

  useEffect(() => {
    // Don't run on public routes
    if (PUBLIC_ROUTES.some(route => location.pathname === route)) {
      return;
    }

    // No token means not logged in
    const currentToken = token || localStorage.getItem('token');
    if (!currentToken) return;

    let lastActivityTime = Date.now();
    let inactivityTimeoutShown = false;

    const updateActivity = () => {
      lastActivityTime = Date.now();
      inactivityTimeoutShown = false;
    };

    const handleLogout = (reason) => {
      console.log(`Logging out: ${reason}`);
      dispatch(resetUser());
      
      if (reason.includes('inactive')) {
        toast.info('You have been logged out due to inactivity.');
      } else if (reason.includes('expired')) {
        toast.warning('Your session has expired. Please login again.');
      }

      navigate('/landingpage');
    };

    // Check token expiration
    const checkTokenExpiry = () => {
      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const expTime = payload.exp * 1000;
        if (Date.now() >= expTime) {
          handleLogout('Token expired');
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error checking token expiry:', error);
        return false;
      }
    };

    // Initial check
    if (!checkTokenExpiry()) return;

    const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    activityEvents.forEach(event => window.addEventListener(event, updateActivity));

    const interval = setInterval(() => {
      const currentToken = token || localStorage.getItem('token');
      if (!currentToken) {
        clearInterval(interval);
        return;
      }

      // Check token expiry
      try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        const expTime = payload.exp * 1000;
        if (Date.now() >= expTime) {
          handleLogout('Token expired');
          return;
        }
      } catch (error) {
        console.error('Error checking token:', error);
      }

      const inactiveTime = Date.now() - lastActivityTime;
      const INACTIVITY_LIMIT = 30 * 60 * 1000;
      const WARNING_TIME = 25 * 60 * 1000;

      if (inactiveTime > INACTIVITY_LIMIT) {
        handleLogout('User inactive for 30 minutes');
      } else if (inactiveTime > WARNING_TIME && !inactivityTimeoutShown) {
        inactivityTimeoutShown = true;
        toast.warning('You will be logged out due to inactivity in 5 minutes.');
      }
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [dispatch, navigate, location.pathname, token, isAuthenticated]);

  return null;
};

export default TokenExpiryChecker;