import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { SessionProvider } from './session';
import { initTelegram } from './tg';

initTelegram();

/**
 * MemoryRouter instead of BrowserRouter: Next.js reloads the page on browser history
 * entries it did not create, which would break the Telegram back button. The first
 * entry is the URL the app was opened at, so /admin and /p/12 links still work.
 */
export default function ClientApp() {
  return (
    <MemoryRouter initialEntries={[window.location.pathname]}>
      <SessionProvider>
        <App />
      </SessionProvider>
    </MemoryRouter>
  );
}
