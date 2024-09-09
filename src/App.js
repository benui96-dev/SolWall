import React, { useState, useEffect, useRef } from 'react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import io from 'socket.io-client';
import { sendTransactionWithMemo, getTokenBalance } from './solanaTransactions';
import DOMPurify from 'dompurify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import './styles.css'; // Assurez-vous que le fichier styles.css est bien configuré

const socket = io('http://localhost:5000');

// Fonction pour convertir les URLs en liens cliquables
const convertUrlsToLinks = (text) => {
  const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%?=~_|])/ig;
  return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
};

const App = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [messages, setMessages] = useState([]);
  const [editorData, setEditorData] = useState('');
  const messagesEndRef = useRef(null); // Référence pour le défilement automatique

  useEffect(() => {
    // Charger les messages depuis le serveur
    const fetchMessages = async () => {
      try {
        const response = await fetch('http://localhost:5000/messages');
        const data = await response.json();
        setMessages(data.reverse()); // Inverser l'ordre des messages pour que les plus récents soient en haut
      } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
      }
    };

    fetchMessages();

    socket.on('message', (message) => {
      // Ajouter le message seulement s'il n'existe pas déjà dans la liste
      setMessages((prevMessages) => {
        const exists = prevMessages.some(msg => msg.signature === message.signature);
        if (!exists) {
          return [message, ...prevMessages]; // Ajouter le nouveau message en haut
        }
        return prevMessages;
      });
    });

    return () => {
      socket.off('message');
    };
  }, []);

  const handleSendTransaction = async () => {
    if (!connected || !editorData) return;

    try {
      // Vérifiez le solde lorsque l'utilisateur clique sur le bouton
      const balance = await getTokenBalance(publicKey);
      const burnAmount = 1; // Remplacez par la valeur réelle de burnAmount
      const isSufficient = balance >= burnAmount;

      if (!isSufficient) {
        console.error('Solde insuffisant pour envoyer le message.');
        return;
      }

      const sanitizedData = convertUrlsToLinks(editorData); // Convertir les URLs en liens cliquables

      const signature = await sendTransactionWithMemo({ publicKey, sendTransaction }, sanitizedData);

      const newMessage = {
        message: sanitizedData, // Utiliser les données converties en liens
        signature: signature,
        solscanLink: `https://solscan.io/tx/${signature}?cluster=testnet`,
      };

      // Envoyer le message au serveur
      await fetch('http://localhost:5000/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMessage),
      });

      socket.emit('newMessage', newMessage);

      setEditorData('');
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la transaction:', error);
    }
  };

  const handleEditorChange = (event, editor) => {
    const data = editor.getData();
    if (data.length <= 100) {
      setEditorData(data);
    }
  };

  useEffect(() => {
    // Ajouter le script du widget CoinMarketCap
    const script = document.createElement('script');
    script.src = 'https://files.coinmarketcap.com/static/widget/currency.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', backgroundColor: 'black', color: '#14F195', overflow: 'hidden' }}>
      {/* Partie gauche */}
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '700px', margin: '20px auto', display: 'block' }} />
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
                    'link',
                    'undo',
                    'redo',
                    'fontColor',
                    'emoji'
                  ],
                }}
                data={editorData}
                onChange={handleEditorChange}
                style={{
                  height: '200px',
                  borderRadius: '5px',
                  backgroundColor: '#333',
                }}
              />
            </div>
            <button
              onClick={handleSendTransaction}
              disabled={!connected || editorData.trim().length > 100} // Désactiver le bouton si le texte dépasse 100 caractères
              style={{
                padding: '10px',
                backgroundColor: '#9945FF', // Couleur de fond du bouton
                color: 'white',
                border: 'none',
                cursor: connected && editorData.trim().length <= 100 ? 'pointer' : 'not-allowed',
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <a href="https://twitter.com/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>Twitter</a>
            <a href="https://discord.gg/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>Discord</a>
            <a href="https://github.com/solana-labs/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>GitHub</a>
          </div>
        </div>

        {/* Widget CoinMarketCap */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <div className="coinmarketcap-currency-widget" data-currencyid="5426" data-base="USD" data-secondary="" data-ticker="true" data-rank="true" data-marketcap="true" data-volume="true" data-statsticker="true" data-stats="USD"></div>
        </div>
      </div>

      {/* Partie droite */}
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column-reverse' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5em', marginBottom: '10px' }}>Derniers Messages</h2>
        <div style={{
          flex: 1,
          borderRadius: '5px',
          padding: '10px',
          backgroundColor: '#222',
          color: '#14F195', // Couleur du texte
          overflowY: 'auto', // Ajoutez un défilement vertical si nécessaire
        }}>
          {messages.map((msg, index) => (
            <div key={index} className="message-content" style={{ marginBottom: '5px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', fontSize: '0.9em' }}>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.message) }} style={{ flex: 1 }} />
              <a href={msg.solscanLink} target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF', marginLeft: '10px', fontSize: '0.8em' }}>
                <FontAwesomeIcon icon={faExternalLinkAlt} /> Voir sur Solscan
              </a>
            </div>
          ))}
          <div ref={messagesEndRef} /> {/* Référence pour faire défiler vers le bas */}
        </div>
      </div>
    </div>
  );
};

export default App;
