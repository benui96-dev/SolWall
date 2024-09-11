import React, { useState, useEffect, useRef } from 'react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import io from 'socket.io-client';
import { sendTransactionWithMemo, getTokenBalance } from './solanaTransactions';
import DOMPurify from 'dompurify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { Editor } from '@tinymce/tinymce-react';
import './styles.css';

const socket = io('http://localhost:5000');

const getTextWithoutUrls = (htmlContent) => {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = htmlContent;
  
  // Parcourir tous les liens et remplacer leur HTML par leur texte visible seulement
  const anchorTags = tempElement.getElementsByTagName('a');
  for (let i = anchorTags.length - 1; i >= 0; i--) {
    const anchor = anchorTags[i];
    const textNode = document.createTextNode(anchor.textContent);
    anchor.parentNode.replaceChild(textNode, anchor);
  }

  return tempElement.textContent || tempElement.innerText || '';  // Récupérer le texte visible
};

const App = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [messages, setMessages] = useState([]);
  const [editorData, setEditorData] = useState('');
  const [visibleTextLength, setVisibleTextLength] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch('http://localhost:5000/messages');
        const data = await response.json();
        setMessages(data.reverse());
      } catch (error) {
        console.error('Erreur lors de la récupération des messages:', error);
      }
    };

    fetchMessages();

    socket.on('message', (message) => {
      setMessages((prevMessages) => {
        const exists = prevMessages.some(msg => msg.signature === message.signature);
        if (!exists) {
          return [message, ...prevMessages];
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
      const balance = await getTokenBalance(publicKey);
      const burnAmount = 1;
      const isSufficient = balance >= burnAmount;

      if (!isSufficient) {
        console.error('Solde insuffisant pour envoyer le message.');
        return;
      }

      const sanitizedData = editorData;  // TinyMCE gère déjà la conversion des URLs
      const signature = await sendTransactionWithMemo({ publicKey, sendTransaction }, sanitizedData);

      const newMessage = {
        message: sanitizedData,
        signature: signature,
        solscanLink: `https://solscan.io/tx/${signature}?cluster=testnet`,
      };

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

  const handleEditorChange = (content, editor) => {
    const textWithoutUrls = getTextWithoutUrls(content);
    if (textWithoutUrls.length <= 75) {
      setEditorData(content);
      setVisibleTextLength(textWithoutUrls.length);
    }
  };

  useEffect(() => {
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
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '700px', margin: '20px auto', display: 'block' }} />
          <p style={{ color: '#14F195', fontSize: '1.2em', marginTop: '10px' }}>
            Write your message for eternity on chain 💫<br />
            Powered by Solana 🔗 & Phantom 👻
          </p>
          <WalletModalProvider>
            <WalletMultiButton style={{ width: '100%', marginBottom: '10px' }} />
          </WalletModalProvider>
        </div>

        {connected && (
          <>
            <p style={{ textAlign: 'center', marginBottom: '10px' }}>Wallet ID: {publicKey.toBase58()}</p>
            <div style={{ marginBottom: '10px' }}>
              <Editor
                init={{
                  height: 200,
                  menubar: false,
                  plugins: 'advlist autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime media table paste code help wordcount emoticons',
                  toolbar: 'undo redo | bold italic | emoticons | link | removeformat',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                  toolbar_mode: 'floating',
                  link_context_toolbar: true,
                  link_title: false,
                  setup: (editor) => {
                    editor.on('PreInit', function() {
                      editor.ui.registry.addButton('link', {
                        icon: 'link',
                        tooltip: 'Insert/edit link',
                        onAction: () => {
                          editor.windowManager.open({
                            title: 'Insert/Edit Link',
                            body: {
                              type: 'panel',
                              items: [
                                {
                                  type: 'input', 
                                  name: 'url', 
                                  label: 'URL',
                                  placeholder: 'Enter the URL'
                                }
                              ]
                            },
                            buttons: [
                              {
                                text: 'Cancel',
                                type: 'cancel'
                              },
                              {
                                text: 'Save',
                                type: 'submit',
                                primary: true
                              }
                            ],
                            onSubmit: (api) => {
                              const data = api.getData();
                              editor.insertContent(`<a href="${data.url}" target="_blank" rel="noopener noreferrer">${data.url}</a>`);
                              api.close();
                            }
                          });
                        }
                      });
                    });
                  }
                }}
                value={editorData}
                onEditorChange={handleEditorChange}
                style={{
                  height: '200px',
                  borderRadius: '5px',
                  backgroundColor: '#333',
                }}
              />
              <p style={{ textAlign: 'center' }}>Remaining characters: {75 - visibleTextLength}</p>
            </div>
            <button
              onClick={handleSendTransaction}
              disabled={!connected || visibleTextLength > 75}
              style={{
                padding: '10px',
                backgroundColor: '#9945FF',
                color: 'white',
                border: 'none',
                cursor: connected && visibleTextLength <= 75 ? 'pointer' : 'not-allowed',
                width: '100%',
                borderRadius: '5px',
              }}
            >
              Envoyer le message
            </button>
          </>
        )}

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <a href="https://twitter.com/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>White paper</a>
            <a href="https://twitter.com/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>Twitter</a>
            <a href="https://discord.gg/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>Telegram</a>
            <a href="https://github.com/solana-labs/solana" target="_blank" rel="noopener noreferrer" style={{ color: '#14F195' }}>GitHub</a>
            <a href="mailto:someone@example.com" style={{ color: '#14F195' }}>Contact</a>
          </div>
        </div>

        {/* Widget CoinMarketCap */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', // Centre verticalement
          alignItems: 'center',      // Centre horizontalement
          height: '22vh',           // Hauteur pleine page
          backgroundColor: 'black', 
          color: '#14F195', 
          overflow: 'hidden' 
        }}>
          <div className="coinmarketcap-currency-widget" data-currencyid="5426" data-base="USD" data-secondary="" data-ticker="true" data-rank="true" data-marketcap="true" data-volume="true" data-statsticker="true" data-stats="USD"></div>
        </div>
      </div>

      {/* Partie droite */}
      <div style={{ width: '50%', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column-reverse' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5em', marginBottom: '10px' }}>Last messages 💬</h2>
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
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.message, { ALLOWED_TAGS: ['a', 'b', 'i', 'strong', 'em'], ALLOWED_ATTR: ['href', 'target', 'rel'] }) }} style={{ flex: 1 }} />
              <a href={msg.solscanLink} target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF', marginLeft: '10px', fontSize: '0.8em' }}>
                <FontAwesomeIcon icon={faExternalLinkAlt} /> See on Solscan
              </a>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default App;
