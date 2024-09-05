// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SolanaProvider from './solanaConfig';
import '@solana/wallet-adapter-react-ui/styles.css'; // Importation des styles pour le Wallet Adapter

// Créer une racine pour React 18
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <SolanaProvider>
    <App />
  </SolanaProvider>
);
