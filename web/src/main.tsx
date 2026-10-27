import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SessionProvider } from './session';
import { initTelegram } from './tg';
import './styles.css';

initTelegram();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SessionProvider>
      <App />
    </SessionProvider>
  </BrowserRouter>,
);
