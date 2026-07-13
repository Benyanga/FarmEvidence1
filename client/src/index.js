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

// REACT_APP_* vars are baked in at `npm run build` time, not read at
// runtime — a missing key here means the deploy platform's env var wasn't
// set (or was added after the last build) rather than a code bug. Fail
// with an actionable message instead of Clerk's minified stack trace,
// which is unreadable without opening devtools on a live deploy.
if (!clerkPubKey) {
  root.render(
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>Configuration error</h1>
      <p>
        <code>REACT_APP_CLERK_PUBLISHABLE_KEY</code> is missing from this build. It must be set as
        an environment variable on the hosting platform (Render → this service → Environment)
        <em> before</em> the build runs — React inlines <code>REACT_APP_*</code> vars at build
        time, so adding it after a deploy requires triggering a fresh build to take effect.
      </p>
    </div>
  );
} else {
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
}

serviceWorkerRegistration.register();
