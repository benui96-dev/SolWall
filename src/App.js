// src/App.js
import React from 'react';
import { WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import styled from 'styled-components';

const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  background-color: black;
  color: white;
  align-items: center;
  justify-content: center;
  font-family: Arial, sans-serif;
`;

const LeftPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50%;
  border-right: 2px solid gray;
  padding: 20px;
`;

const Title = styled.h1`
  font-size: 48px;
  margin-bottom: 20px;
`;

const WalletInfo = styled.div`
  margin-top: 20px;
  font-size: 18px;
`;

const RightPane = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50%;
  padding: 20px;
`;

const SocialLinks = styled.div`
  margin-top: 40px;
  display: flex;
  gap: 15px;
`;

const SocialLink = styled.a`
  color: white;
  text-decoration: none;
  font-size: 20px;
`;

const App = () => {
  const { publicKey } = useWallet(); // Récupère les informations du wallet connecté

  return (
    <AppContainer>
      <LeftPane>
        <Title>SolWall</Title>
        <WalletMultiButton />
        {publicKey && (
          <>
            <WalletInfo>
              <p>ID du wallet : {publicKey.toBase58()}</p>
            </WalletInfo>
            <WalletDisconnectButton />
          </>
        )}
        <SocialLinks>
          <SocialLink href="https://twitter.com" target="_blank">Twitter</SocialLink>
          <SocialLink href="https://discord.com" target="_blank">Discord</SocialLink>
          <SocialLink href="https://github.com" target="_blank">GitHub</SocialLink>
        </SocialLinks>
      </LeftPane>
      <RightPane>
        {/* Contenu supplémentaire ou placeholder pour la partie droite */}
        <p>Bienvenue dans votre application Solana !</p>
      </RightPane>
    </AppContainer>
  );
};

export default App;
