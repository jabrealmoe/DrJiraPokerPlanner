import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@atlaskit/css-reset';
import { setGlobalTheme } from '@atlaskit/tokens';

// Enable Design Tokens
setGlobalTheme({
   colorMode: 'auto'
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
