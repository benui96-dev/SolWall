require('dotenv').config();
const axios = require('axios');
const {
  Connection,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { getOrca, Network } = require('@orca-so/sdk');
const { getRaydium } = require('./raydium-sdk'); // Assurez-vous d'importer votre SDK Raydium ici

const connection = new Connection(clusterApiUrl(process.env.NETWORK), 'confirmed');
const LIQUIDITY_THRESHOLD = 1000;

async function main() {
  const solPairs = await scanPairs();
  if (solPairs.length === 0) {
    console.log('Aucune paire SOL avec suffisamment de liquidité trouvée.');
    return;
  }

  for (const pair of solPairs) {
    await performSandwich(pair);
  }
}

async function scanPairs() {
  const raydiumPairs = await getRaydiumPairs();
  const orcaPairs = await getOrcaPairs();
  const allPairs = [...raydiumPairs, ...orcaPairs];
  return allPairs.filter(pair => pair.baseMint === 'So11111111111111111111111111111111111111112'); // Mint SOL
}

async function getRaydiumPairs() {
  const response = await axios.get('https://api.raydium.io/pairs');
  return response.data.data;
}

async function getOrcaPairs() {
  const response = await axios.get('https://api.orca.so/v1/pairs');
  return response.data;
}

async function filterLiquidPairs(solPairs) {
  const liquidPairs = [];
  for (const pair of solPairs) {
    const liquidity = await getLiquidity(pair.address);
    if (liquidity >= LIQUIDITY_THRESHOLD) {
      liquidPairs.push(pair);
    }
  }
  return liquidPairs;
}

async function getLiquidity(marketAddress) {
  const raydiumResponse = await axios.get(`https://api.raydium.io/orderbook/${marketAddress}`);
  const orcaResponse = await axios.get(`https://api.orca.so/v1/market/${marketAddress}`);

  let totalLiquidity = 0;
  // Calculer la liquidité de Raydium
  if (raydiumResponse.data.data) {
    const bids = raydiumResponse.data.data.bids;
    const asks = raydiumResponse.data.data.asks;
    bids.forEach(bid => {
      totalLiquidity += bid.size;
    });
    asks.forEach(ask => {
      totalLiquidity += ask.size;
    });
  }

  // Calculer la liquidité d'Orca
  if (orcaResponse.data) {
    const bids = orcaResponse.data.bids;
    const asks = orcaResponse.data.asks;
    bids.forEach(bid => {
      totalLiquidity += bid.size;
    });
    asks.forEach(ask => {
      totalLiquidity += ask.size;
    });
  }

  return totalLiquidity;
}

async function performSandwich(pair) {
  const wallet = /* Initialize your wallet here, e.g., using a keypair */;
  const tokenMint = pair.baseMint;
  const amountToBuy = /* Calculer la quantité à acheter */;

  try {
    // Déterminer le DEX à utiliser (vous pouvez personnaliser cette logique)
    const dex = /* 'orca' ou 'raydium', selon votre logique */;
    
    const currentPrice = await getCurrentPrice(pair.address);
    const slippage = 0.01; // 1% de slippage
    const minAmountOut = (1 - slippage) * amountToBuy * currentPrice;

    console.log(`Achat de ${amountToBuy} ${tokenMint} sur ${dex} pour la paire: ${pair.address}`);
    await buyToken(wallet, tokenMint, amountToBuy, minAmountOut, pair.address, dex);

    await new Promise(resolve => setTimeout(resolve, 5000)); // Pause de 5 secondes

    const newPrice = await getCurrentPrice(pair.address);
    const amountToSell = /* Calculer la quantité à vendre */;
    const minAmountOutSell = (1 - slippage) * amountToSell * newPrice;

    console.log(`Vente de ${amountToSell} ${tokenMint} sur ${dex} pour la paire: ${pair.address}`);
    await sellToken(wallet, tokenMint, amountToSell, minAmountOutSell, pair.address, dex);

  } catch (error) {
    console.error('Erreur lors de l\'exécution du sandwich:', error);
  }
}

async function buyToken(wallet, tokenMint, amount, minAmountOut, pairAddress, dex) {
  let transaction = new Transaction();
  try {
    if (dex === 'orca') {
      const orca = getOrca(connection, { cluster: process.env.NETWORK === 'mainnet-beta' ? Network.MAINNET : Network.DEVNET });
      const pool = orca.getPool(pairAddress);
      const order = pool.makeSwap({
        inputToken: pool.getTokenA(),
        outputToken: pool.getTokenB(),
        amountIn: amount,
        slippage: 0.01,
      });
      transaction.add(order);
      
    } else if (dex === 'raydium') {
      const raydium = getRaydium(connection);
      const order = await raydium.swap({
        wallet: wallet,
        amountIn: amount,
        minAmountOut: minAmountOut,
        pairAddress: pairAddress,
        slippage: 0.01,
      });
      transaction.add(order);
      
    } else {
      throw new Error('DEX non supporté. Veuillez choisir entre "orca" et "raydium".');
    }

    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
    console.log(`Achat réussi! Signature de la transaction: ${signature}`);
    return signature;

  } catch (error) {
    console.error('Erreur lors de l\'achat du token:', error);
    throw error;
  }
}

async function sellToken(wallet, tokenMint, amount, minAmountOut, pairAddress, dex) {
  let transaction = new Transaction();
  try {
    if (dex === 'orca') {
      const orca = getOrca(connection, { cluster: process.env.NETWORK === 'mainnet-beta' ? Network.MAINNET : Network.DEVNET });
      const pool = orca.getPool(pairAddress);
      const order = pool.makeSwap({
        inputToken: pool.getTokenB(),
        outputToken: pool.getTokenA(),
        amountIn: amount,
        slippage: 0.01,
      });
      transaction.add(order);
      
    } else if (dex === 'raydium') {
      const raydium = getRaydium(connection);
      const order = await raydium.swap({
        wallet: wallet,
        amountIn: amount,
        minAmountOut: minAmountOut,
        pairAddress: pairAddress,
        slippage: 0.01,
      });
      transaction.add(order);
      
    } else {
      throw new Error('DEX non supporté. Veuillez choisir entre "orca" et "raydium".');
    }

    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
    console.log(`Vente réussie! Signature de la transaction: ${signature}`);
    return signature;

  } catch (error) {
    console.error('Erreur lors de la vente du token:', error);
    throw error;
  }
}

async function getCurrentPrice(pairAddress) {
  const response = await axios.get(`https://api.raydium.io/orderbook/${pairAddress}`);
  const price = response.data.data.price; // Ajustez selon la structure de l'API
  return price;
}

main().catch(console.error);
