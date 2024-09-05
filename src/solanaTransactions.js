import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createBurnInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { MEMO_PROGRAM_ID } from '@solana/spl-memo';

const connection = new Connection(clusterApiUrl(process.env.REACT_APP_SOLANA_NETWORK), 'confirmed');

const FEE_ADDRESS = new PublicKey(process.env.REACT_APP_FEE_ADDRESS);
const TOKEN_MINT_ADDRESS = new PublicKey(process.env.REACT_APP_TOKEN_MINT_ADDRESS);
const TOKEN_DECIMALS = parseInt(process.env.REACT_APP_TOKEN_DECIMALS, 10); // Décimales du token

// Vérification des variables
if (isNaN(TOKEN_DECIMALS)) {
  throw new Error('Invalid TOKEN_DECIMALS value');
}

// Fonction pour envoyer une transaction avec memo et brûler un token SPL
export const sendTransactionWithMemo = async (wallet, memoText) => {
  const { publicKey, sendTransaction } = wallet;
  if (!publicKey) throw new Error('Wallet not connected');

  // Obtenir l'adresse du compte token associé
  const tokenAccountPubkey = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);

  // Vérifier si le compte SPL existe
  const accountInfo = await connection.getAccountInfo(tokenAccountPubkey);
  if (!accountInfo) {
    throw new Error('No associated token account found for this wallet');
  }

  // Créer une nouvelle transaction
  const transaction = new Transaction();

  // Brûler 1 token SPL
  const burnAmount = 1 * 10 ** TOKEN_DECIMALS; // Conversion en unités de base
  if (isNaN(burnAmount)) {
    throw new Error('Invalid burn amount');
  }

  transaction.add(
    createBurnInstruction(
      tokenAccountPubkey,    // Le compte token de l'utilisateur
      TOKEN_MINT_ADDRESS,    // Le token SPL à brûler
      publicKey,             // L'utilisateur propriétaire du token
      burnAmount,            // Nombre de tokens à brûler, en unités de base
      [],                    // Signers supplémentaires (vide dans ce cas)
      TOKEN_PROGRAM_ID       // Programme token de Solana
    )
  );

  // Ajouter des frais en SOL (via un transfert standard)
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: FEE_ADDRESS,
      lamports: 1000000, // Frais en SOL (0.001 SOL)
    })
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
        solscanLink: `https://solscan.io/tx/${signatureInfo.signature}?cluster=${process.env.REACT_APP_SOLANA_NETWORK}`,
      };
    })
  );

  // Filtrer les messages valides
  return messages.filter((msg) => msg.message);
};
