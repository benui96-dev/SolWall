import React, { useState, useEffect } from 'react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import io from 'socket.io-client';
import { sendTransactionWithMemo } from './solanaTransactions';
import DOMPurify from 'dompurify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import './styles.css'; // Assurez-vous que le fichier styles.css est bien configuré

const socket = io('http://localhost:5000');

const App = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [messages, setMessages] = useState([]);
  const [editorData, setEditorData] = useState('');

  useEffect(() => {
    socket.on('message', (message) => {
      setMessages((prevMessages) => [message, ...prevMessages]);
    });

    return () => {
      socket.off('message');
    };
  }, []);

  const handleSendTransaction = async () => {
    if (!connected || !editorData) return;

    try {
      const signature = await sendTransactionWithMemo({ publicKey, sendTransaction }, editorData);

      socket.emit('newMessage', {
        message: editorData,
        signature: signature,
        solscanLink: `https://solscan.io/tx/${signature}?cluster=testnet`,
      });

      alert(`Transaction envoyée: https://solscan.io/tx/${signature}?cluster=testnet`);
      setEditorData('');
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la transaction:', error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', backgroundColor: 'black', color: 'white', overflow: 'hidden' }}>
      {/* Partie gauche */}
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '2em' }}>SolWall</h1>
          <img src="/robot.svg" alt="Logo" style={{ width: '100px', margin: '20px auto', display: 'block' }} />
          <br /> {/* Retour à la ligne après le logo */}
          <WalletModalProvider>
            <WalletMultiButton style={{ width: '100%', marginBottom: '10px' }} />
          </WalletModalProvider>
        </div>

        {connected && (
          <>
            <p style={{ textAlign: 'center', marginBottom: '10px' }}>Wallet ID: {publicKey.toBase58()}</p>
            <div style={{ marginBottom: '10px' }}>
              <CKEditor
                editor={ClassicEditor}
                config={{
                  toolbar: [
                    'bold',
                    'italic',
                    'underline',
                    'link',
                    'bulletedList',
                    'numberedList',
                    'blockQuote',
                    'undo',
                    'redo',
                    'fontSize',
                    'fontFamily',
                    'fontColor',
                    'fontBackgroundColor',
                    'alignment',
                    'highlight',
                    'emoji'
                  ],
                  // Assurez-vous que les plugins sont inclus
                }}
                data={editorData}
                onChange={(event, editor) => {
                  const data = editor.getData();
                  setEditorData(data);
                }}
                style={{
                  height: '200px',
                  borderRadius: '5px',
                  backgroundColor: '#333',
                  color: 'white',
                }}
              />
            </div>
            <button
              onClick={handleSendTransaction}
              style={{
                padding: '10px',
                backgroundColor: '#00bfff',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                width: '100%', // Largeur à 100%
                borderRadius: '5px',
              }}
            >
              Envoyer le message
            </button>
          </>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p>Suivez-nous :</p>
          <a href="https://twitter.com/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff', display: 'block', marginBottom: '5px' }}>Twitter</a>
          <a href="https://discord.gg/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff', display: 'block', marginBottom: '5px' }}>Discord</a>
          <a href="https://github.com/solana-labs/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff' }}>GitHub</a>
        </div>
      </div>

      {/* Partie droite */}
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ textAlign: 'center' }}>Derniers Messages</h2>
        <div style={{
          flex: 1,
          borderRadius: '5px',
          padding: '10px',
          backgroundColor: '#222',
          color: 'white',
          overflowY: 'auto', // Ajoutez un défilement vertical si nécessaire
        }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #333' }}>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.message) }} />
              <a href={msg.solscanLink} target="_blank" rel="noopener noreferrer" style={{ color: '#00bfff' }}>
                <FontAwesomeIcon icon={faExternalLinkAlt} /> Voir sur Solscan
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
