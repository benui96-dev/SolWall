// src/MessagesDisplay.js
import React from 'react';
import styled from 'styled-components';

const MessageContainer = styled.div`
  border: 1px solid white;
  width: 100%;
  padding: 10px;
  margin-bottom: 10px;
`;

const MessageLink = styled.a`
  color: lightblue;
  text-decoration: none;
`;

const MessagesDisplay = ({ messages }) => {
  return (
    <div>
      {messages.map((message) => (
        <MessageContainer key={message.signature}>
          <p>{message.text}</p>
          <MessageLink
            href={`https://solscan.io/tx/${message.signature}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Solscan
          </MessageLink>
        </MessageContainer>
      ))}
    </div>
  );
};

export default MessagesDisplay;
