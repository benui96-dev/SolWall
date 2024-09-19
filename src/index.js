import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SolanaProvider from './solanaConfig';
import '@solana/wallet-adapter-react-ui/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <SolanaProvider>
    <App />
  </SolanaProvider>
);
