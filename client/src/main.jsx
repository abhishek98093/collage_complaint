// main.jsx - WITHOUT Router (Router is in App.jsx)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// ❌ Remove Router from here
import App from './App.jsx';
import './index.css';

import { Provider } from 'react-redux';           
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">Loading your dashboard...</p>
      <p className="text-gray-400 text-sm mt-2">Please wait</p>
    </div>
  </div>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={<LoadingFallback />} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          {/* ❌ NO Router here - Router is inside App.jsx */}
          <App />
          <ToastContainer 
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  </StrictMode>
);