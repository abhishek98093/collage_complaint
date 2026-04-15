// slices/userSlice.js
import { createSlice } from '@reduxjs/toolkit';

// Helper to load initial state from localStorage
const loadInitialState = () => {
  try {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (userStr && token) {
      const user = JSON.parse(userStr);
      console.log('Loading initial user state:', { user, token: token.substring(0, 20) + '...' });
      return {
        user: user,
        token: token,
        isAuthenticated: true,
        logedAt: Date.now(),
      };
    }
  } catch (error) {
    console.error('Error loading initial state:', error);
  }
  
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    logedAt: null,
  };
};

const initialState = loadInitialState();

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      const { user, token, logedAt } = action.payload;
      
      console.log('🔐 Setting user in Redux:', { 
        role: user?.role, 
        name: user?.name,
        email: user?.email,
        token: token ? token.substring(0, 20) + '...' : null 
      });
      
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      state.logedAt = logedAt || Date.now();
      
      // Save to localStorage
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', token);
      
      console.log('✅ User saved to localStorage');
    },
    
    updateUserProfile: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
        console.log('📝 User profile updated:', state.user);
      }
    },
    
    resetUser: (state) => {
      console.log('🔴 Resetting user state');
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.logedAt = null;
      
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      console.log('🗑️ User cleared from localStorage');
    },
  },
});

export const { setUser, updateUserProfile, resetUser } = userSlice.actions;
export default userSlice.reducer;