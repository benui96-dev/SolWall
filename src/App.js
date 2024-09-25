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

//DEV const socket = io('http://localhost:5000');
const socket = io('https://solwall.live', {
  transports: ['websocket', 'polling']
});

const getTextWithoutUrls = (htmlContent) => {
  const tempElement = document.createElement('div');
  tempElement.innerHTML = htmlContent;

  const anchorTags = tempElement.getElementsByTagName('a');
  for (let i = anchorTags.length - 1; i >= 0; i--) {
    const anchor = anchorTags[i];
    const textNode = document.createTextNode(anchor.textContent);
    anchor.parentNode.replaceChild(textNode, anchor);
  }

  return tempElement.textContent || tempElement.innerText || '';
};

const App = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [messages, setMessages] = useState([]);
  const [editorData, setEditorData] = useState('');
  const [visibleTextLength, setVisibleTextLength] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [platformFees, setPlatformFees] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchMessagesAndStats = async () => {
      try {
        //DEV const response = await fetch('http://localhost:5000/messages');
        const response = await fetch('https://solwall.live/messages');
        const data = await response.json();
        setMessages(data.reverse());
      } catch (error) {
        console.error('Error retrieving messages and stats:', error);
      }
    };

    fetchMessagesAndStats();

    socket.on('message', (message) => {
      setMessages((prevMessages) => {
        const exists = prevMessages.some(msg => msg.signature === message.signature);
        if (!exists) {
          return [message, ...prevMessages];
        }
        return prevMessages;
      });
    });

    socket.on('allMessages', (allMessages) => {
      setMessages(allMessages.reverse());
    });

    socket.on('platformStats', (stats) => {
      setPlatformFees(stats.platformFees);
      setMessageCount(stats.messageCount);
    });

    return () => {
      socket.off('message');
      socket.off('allMessages');
      socket.off('platformStats');
    };
  }, []);

  const handleSendTransaction = async () => {
    if (!connected || !editorData) return;

    try {
      const balance = await getTokenBalance(publicKey);
      const burnAmount = 1;
      const isSufficient = balance >= burnAmount;

      if (!isSufficient) {
        console.error('Insufficient balance to send message.');
        return;
      }

      const sanitizedData = editorData;
      const signature = await sendTransactionWithMemo({ publicKey, sendTransaction }, sanitizedData);

      const newMessage = {
        message: sanitizedData,
        signature: signature,
        solscanLink: `https://solscan.io/tx/${signature}?cluster=testnet`,
      };

      //DEV await fetch('http://localhost:5000/messages', {
      await fetch('https://solwall.live/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMessage),
      });

      socket.emit('message', newMessage);
      setEditorData('');
    } catch (error) {
      console.error('Error sending transaction:', error);
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
    <div className='app-container' style={{ display: 'flex', height: '100vh', backgroundColor: 'black', color: '#14F195' }}>
      <div className='left-column'>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/logo.jpg" alt="Logo" className="app-logo" style={{ width: '50%', margin: '20px auto' }} />
          <p style={{ color: '#14F195', fontSize: '1.2em', marginTop: '10px' }}>
            Write your message for eternity on chain 💫<br />
            Powered by Solana 🔗 & Phantom 👻
          </p>
          <WalletModalProvider>
            <WalletMultiButton style={{ width: '100%', marginBottom: '10px' }} />
          </WalletModalProvider>
        </div>

        <div className='editor-container'>
          {connected && (
            <>
              <p style={{ textAlign: 'center', marginBottom: '10px' }}>Wallet ID: {publicKey.toBase58()}</p>
              <div style={{ marginBottom: '10px' }}>
                <Editor
                  init={{
                    height: 150,
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
                Send message
              </button>
            </>
          )}
        </div>

        <div className='project-info' style={{ marginTop: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            Contract: 
            <a href="" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>xxx</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            Project:
            <a href="https://whitepaper.solwall.live/sol-wall-project/user-guide" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>User guide</a>
            <a href="https://whitepaper.solwall.live" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>White paper</a>
            <a href="https://x.com/solwall_token" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Twitter</a>
            <a href="https://t.me/solwall_token" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Telegram</a>
            <a href="https://rugcheck.xyz/tokens/" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>RugCheck</a>
            <a href="mailto:" style={{ color: '#9945FF' }}>Contact</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            Buy on:
            <a href="https://jup.ag/swap/SOL-" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Jupiter</a>
            <a href="https://raydium.io/swap/?from=11111111111111111111111111111111&to=" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Raydium</a>
            <a href="https://www.orca.so/?outputCurrency=" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Orca</a>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            Charts:
            <a href="https://www.dextools.io/app/en/solana/pair-explorer/" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Dextools</a>
            <a href="https://dexscreener.com/solana/" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Dexscreener</a>
            <a href="https://birdeye.so/token/" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>Birdeye</a>
            <a href="#" target="_blank" rel="noopener noreferrer" style={{ color: '#9945FF' }}>CoinMarketCap</a>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'black',
          color: '#14F195',
          overflow: 'visible'
        }}>
          <div className="coinmarketcap-currency-widget" data-currencyid="5426" data-base="USD" data-secondary="" data-ticker="true" data-rank="true" data-marketcap="true" data-volume="true" data-statsticker="true" data-stats="USD"></div>
        </div>
      </div>

      <div className='right-column'>
        <h2 style={{ textAlign: 'center', fontSize: '1em', marginBottom: '0px' }}>
          💬 Total number of messages: {messageCount}&nbsp;
          💵 Platform fees generated: {platformFees.toFixed(4)} SOL
        </h2>
        <div style={{
          flex: 1,
          borderRadius: '5px',
          padding: '10px',
          backgroundColor: '#222',
          color: '#14F195',
          overflowY: 'auto',
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
