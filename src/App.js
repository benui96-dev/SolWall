// src/App.js
import React, { useState, useEffect } from 'react';
import { WalletModalProvider, WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import io from 'socket.io-client';
import { sendTransactionWithMemo } from './solanaTransactions';

// Configurer Socket.IO
const socket = io('http://localhost:5000'); // Remplacez par l'URL de votre serveur

const App = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [messages, setMessages] = useState([]);
  const [memoText, setMemoText] = useState('');

  useEffect(() => {
    // Écouter les messages en temps réel
    socket.on('message', (message) => {
      setMessages((prevMessages) => [message, ...prevMessages]);
    });

    return () => {
      socket.off('message');
    };
  }, []);

  const handleSendTransaction = async () => {
    if (!connected || !memoText) return;

    try {
      const signature = await sendTransactionWithMemo({ publicKey, sendTransaction }, memoText);

      // Envoyer le message au serveur
      socket.emit('newMessage', {
        message: memoText,
        signature: signature,
        solscanLink: `https://solscan.io/tx/${signature}?cluster=testnet`,
      });

      alert(`Transaction envoyée: https://solscan.io/tx/${signature}?cluster=testnet`);
      setMemoText(''); // Réinitialiser le champ texte après l'envoi
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la transaction:', error);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'black', color: 'white' }}>
      {/* Partie gauche */}
      <div style={{ width: '50%', padding: '20px', borderRight: '2px solid white' }}>
        <h1 style={{ textAlign: 'center' }}>SolWall</h1>
        <img src="/robot.svg" alt="Logo" style={{ display: 'block', margin: '20px auto', width: '100px' }} />
        <WalletModalProvider>
          <WalletMultiButton />
          {connected && <WalletDisconnectButton />}
        </WalletModalProvider>

        {connected && (
          <>
            <p>Wallet ID: {publicKey.toBase58()}</p>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              maxLength="100"
              placeholder="Écrivez un message"
              style={{ width: '100%', marginBottom: '10px', height: '100px' }}
            />
            <button
              onClick={handleSendTransaction}
              style={{
                padding: '10px 20px',
                backgroundColor: '#00bfff',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Envoyer le message
            </button>
            <div style={{ marginTop: '20px' }}>
              <a href="https://twitter.com/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff', display: 'block', textAlign: 'center' }}>Twitter</a>
              <a href="https://discord.gg/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff', display: 'block', textAlign: 'center' }}>Discord</a>
              <a href="https://github.com/solana-labs/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff', display: 'block', textAlign: 'center' }}>GitHub</a>
            </div>
          </>
        )}
      </div>

      {/* Partie droite */}
      <div style={{ width: '50%', padding: '20px', overflowY: 'scroll' }}>
        <h2>Derniers Messages</h2>
        {messages.map((msg, index) => (
          <div key={index} style={{ border: '1px solid white', padding: '10px', marginBottom: '10px' }}>
            <p>{msg.message}</p>
            <a href={msg.solscanLink} target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff' }}>
              Voir sur Solscan
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
