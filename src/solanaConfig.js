// src/solanaConfig.js
import React from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

const SolanaProvider = ({ children }) => {
  const network = clusterApiUrl('mainnet-beta'); // Vous pouvez aussi utiliser 'devnet' ou 'testnet'
  const wallets = [new PhantomWalletAdapter()]; // Liste des wallets supportés

  return (
    <ConnectionProvider endpoint={network}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaProvider;
