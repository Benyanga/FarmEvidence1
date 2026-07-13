import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { useAuth } from '@clerk/clerk-react';

import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './i18n';

import App from './App';
import { RoleProvider } from './context/RoleContext';
import { SyncProvider } from './context/SyncContext';
import { setTokenGetter } from './services/api';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const clerkPubKey = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

function ApiTokenBridge({ children }) {
  const { getToken } = useAuth();
  setTokenGetter(() => getToken());
  return children;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <ApiTokenBridge>
        <BrowserRouter>
          <RoleProvider>
            <SyncProvider>
              <App />
            </SyncProvider>
          </RoleProvider>
        </BrowserRouter>
      </ApiTokenBridge>
    </ClerkProvider>
  </React.StrictMode>
);

serviceWorkerRegistration.register();
