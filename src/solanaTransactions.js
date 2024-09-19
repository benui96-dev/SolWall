  import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
  import { createBurnInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
  import { MEMO_PROGRAM_ID } from '@solana/spl-memo';

  const connection = new Connection(clusterApiUrl(process.env.REACT_APP_SOLANA_NETWORK), 'confirmed');

  const FEE_ADDRESS = new PublicKey(process.env.REACT_APP_FEE_ADDRESS);
  const TOKEN_MINT_ADDRESS = new PublicKey(process.env.REACT_APP_TOKEN_MINT_ADDRESS);
  const TOKEN_DECIMALS = parseInt(process.env.REACT_APP_TOKEN_DECIMALS, 10);

  if (isNaN(TOKEN_DECIMALS)) {
    throw new Error('Invalid TOKEN_DECIMALS value');
  }

  const sanitizeText = (text) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  export const sendTransactionWithMemo = async (wallet, memoText) => {
    const { publicKey, sendTransaction } = wallet;
    if (!publicKey) throw new Error('Wallet not connected');

    const tokenAccountPubkey = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
    const accountInfo = await connection.getAccountInfo(tokenAccountPubkey);
    if (!accountInfo) {
      throw new Error('No associated token account found for this wallet');
    }

    const transaction = new Transaction();

    const burnAmount = Math.pow(10, TOKEN_DECIMALS);
    transaction.add(
      createBurnInstruction(
        tokenAccountPubkey,
        TOKEN_MINT_ADDRESS,
        publicKey,
        burnAmount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: FEE_ADDRESS,
        lamports: 10000000, //(0.0001 SOL)
      })
    );

    const cleanMemoText = sanitizeText(memoText);

    transaction.add({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(cleanMemoText),
    });

    const signature = await sendTransaction(transaction, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  };

  export const getTokenBalance = async (publicKey) => {
    const tokenAccountPubkey = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
    const accountInfo = await connection.getAccountInfo(tokenAccountPubkey);
    
    if (!accountInfo) {
      throw new Error('No associated token account found for this wallet');
    }

    const accountData = Buffer.from(accountInfo.data);
    const amount = accountData.readBigUInt64LE(64); // La position peut varier; vérifiez selon le layout
    return Number(amount) / Math.pow(10, TOKEN_DECIMALS);
  };

  export const getRecentMessages = async () => {
    const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const signatures = await connection.getSignaturesForAddress(memoProgramId, {
      limit: 100,
    });

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

    return messages.filter((msg) => msg.message);
  };
