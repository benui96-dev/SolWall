import React, { useState } from 'react';
import styled from 'styled-components';
import { sendTransactionWithMemo } from './solanaTransactions';

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  width: 100%;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 50px;
  max-length: 100;
  border-radius: 5px;
  padding: 10px;
  resize: none;
`;

const SendButton = styled.button`
  background-color: #5c6bc0;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  margin-top: 10px;
  cursor: pointer;
  font-size: 16px;
  &:hover {
    background-color: #3f51b5;
  }
`;

const MessageForm = () => {
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.length > 0 && message.length <= 100) {
      await sendTransactionWithMemo(message);
      setMessage('');
    }
  };

  return (
    <FormContainer>
      <TextArea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message (100 characters max)"
        maxLength={100}
      />
      <SendButton onClick={handleSubmit}>Send Message</SendButton>
    </FormContainer>
  );
};

export default MessageForm;
