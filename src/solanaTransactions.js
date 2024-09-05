// src/solanaTransactions.js
import { clusterApiUrl, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createBurnInstruction, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { MEMO_PROGRAM_ID } from '@solana/spl-memo';

const connection = new Connection(clusterApiUrl(process.env.REACT_APP_SOLANA_NETWORK));

const FEE_ADDRESS = new PublicKey(process.env.REACT_APP_FEE_ADDRESS);
const TOKEN_MINT_ADDRESS = new PublicKey(process.env.REACT_APP_TOKEN_MINT_ADDRESS);

// Fonction pour envoyer une transaction avec un memo et brûler un token SPL
export const sendTransactionWithMemo = async (wallet, memoText) => {
  const { publicKey, sendTransaction } = wallet;
  if (!publicKey) throw new Error('Wallet not connected');

  // Récupération du compte token associé
  const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, {
    mint: TOKEN_MINT_ADDRESS,
  });

  if (tokenAccounts.value.length === 0) {
    throw new Error('No SPL token account found for this wallet');
  }

  const tokenAccountPubkey = tokenAccounts.value[0].pubkey;

  // Création d'une nouvelle transaction
  const transaction = new Transaction();

  // Brûler 1 token SPL
  transaction.add(
    createBurnInstruction(
      TOKEN_PROGRAM_ID,
      tokenAccountPubkey,
      publicKey,
      1 // Brûler 1 token SPL
    )
  );

  // Ajouter des frais en SOL à l'adresse de destination
  transaction.add(
    createTransferInstruction(
      TOKEN_PROGRAM_ID,
      publicKey,
      FEE_ADDRESS,
      publicKey,
      [],
      0.001 // Frais à ajuster si nécessaire
    )
  );

  // Ajouter le memo à la transaction
  transaction.add({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText),
  });

  // Envoyer la transaction
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, 'confirmed');
  return signature;
};

// Fonction pour récupérer les 100 derniers messages
export const getRecentMessages = async () => {
  const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

  // Obtenir les signatures des transactions associées au programme Memo
  const signatures = await connection.getSignaturesForAddress(memoProgramId, {
    limit: 100,
  });

  // Extraire les messages (memos) des transactions
  const messages = await Promise.all(
    signatures.map(async (signatureInfo) => {
      const tx = await connection.getTransaction(signatureInfo.signature);
      const memoInstruction = tx.transaction.message.instructions.find(
        (instruction) => instruction.programId.toBase58() === memoProgramId.toBase58()
      );

      return {
        message: memoInstruction ? memoInstruction.data.toString() : null,
        signature: signatureInfo.signature,
        solscanLink: `https://solscan.io/tx/${signatureInfo.signature}?cluster=testnet`,
      };
    })
  );

  // Filtrer les messages valides
  return messages.filter((msg) => msg.message);
};
