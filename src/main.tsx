import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { AppStoreProvider } from './store/AppStore';
import { LocalStorageAdapter } from './storage/adapter';
import { ReminderProvider } from './reminders/ReminderProvider';
import { registerNotificationWorker } from './reminders/notifier';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SharedProvider } from './shared/SharedProvider';

// Единственное место, где выбирается хранилище. Для облака здесь появится другой адаптер.
const adapter = new LocalStorageAdapter();

void registerNotificationWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppStoreProvider adapter={adapter}>
        <ToastProvider>
          <ReminderProvider>
            <SharedProvider>
              <App />
            </SharedProvider>
          </ReminderProvider>
        </ToastProvider>
      </AppStoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
