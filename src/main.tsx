import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        void reg.unregister();
      }
    });
  } else {
    registerSW({
      immediate: true,
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent('educare:offline-ready'));
      },
      onRegisterError(error) {
        console.warn('Service worker registration skipped:', error);
      },
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
