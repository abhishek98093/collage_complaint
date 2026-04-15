// store/store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import userReducer from '../slices/userSlice';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['user'],
};

const rootReducer = combineReducers({
  user: userReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// Log state changes for debugging
store.subscribe(() => {
  const state = store.getState();
  console.log('📊 Store state updated:', {
    user: state.user?.user,
    isAuthenticated: state.user?.isAuthenticated,
    hasToken: !!state.user?.token
  });
});

export const persistor = persistStore(store);

// Log when rehydration is complete
persistor.subscribe(() => {
  const { bootstrapped } = persistor.getState();
  if (bootstrapped) {
    console.log('✅ Redux Persist rehydration complete');
    const state = store.getState();
    console.log('📦 Rehydrated state:', {
      user: state.user?.user,
      role: state.user?.user?.role,
      isAuthenticated: state.user?.isAuthenticated
    });
  }
});