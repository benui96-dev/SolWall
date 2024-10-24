require('dotenv').config();
const axios = require('axios');
const {
  Connection,
  PublicKey,
  clusterApiUrl,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { getOrca, Orca, Network } = require('@orca-so/sdk');

const connection = new Connection(clusterApiUrl(process.env.NETWORK), 'confirmed');
const LARGE_TRANSACTION_THRESHOLD = 5; // Seuil pour les gros achats en SOL
let isTransactionInProgress = false;
const CHECK_INTERVAL = 5000; // Intervalle de vérification en millisecondes

async function main() {
  // Démarrer le monitoring des paires
  await monitorOrderBooks();
}

async function monitorOrderBooks() {
  const solPairs = await scanPairs();

  if (solPairs.length === 0) {
    console.log('Aucune paire SOL trouvée.');
    return;
  }

  setInterval(async () => {
    for (const pair of solPairs) {
      await checkOrderBook(pair);
    }
  }, CHECK_INTERVAL);
}

async function checkOrderBook(pair) {
  try {
    const orderBook = await getLiquidity(pair.address);

    // Vérifiez les gros achats à partir des ordres
    const largeBuyOrders = orderBook.bids.filter(order => order.size >= LARGE_TRANSACTION_THRESHOLD);

    if (largeBuyOrders.length > 0) {
      console.log(`Gros achats détectés sur la paire ${pair.address}:`, largeBuyOrders);
      await handleLargePurchase(largeBuyOrders[0].size); // Passer la première grande commande détectée
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du carnet d\'ordres:', error);
  }
}

async function handleLargePurchase(amount) {
  if (isTransactionInProgress) {
    console.log('Une transaction est déjà en cours. Attendez qu\'elle se termine.');
    return;
  }

  isTransactionInProgress = true;

  const solPairs = await scanPairs();
  if (solPairs.length === 0) {
    console.log('Aucune paire SOL avec suffisamment de liquidité trouvée.');
    isTransactionInProgress = false;
    return;
  }

  for (const pair of solPairs) {
    const dex = determineDex(pair); // Déterminez le DEX à utiliser pour la paire
    await performSandwich(pair, amount, dex); // Passer la quantité achetée
  }

  isTransactionInProgress = false;
}

function determineDex(pair) {
    // Logique pour déterminer quel DEX utiliser (par exemple, en fonction de la paire ou de l'adresse)
    if (pair.dex === 'orca') {
      return 'orca';
    } else if (pair.dex === 'raydium') {
      return 'raydium';
    }
    return null; // Ou une valeur par défaut
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

async function getLiquidity(marketAddress) {
  const raydiumResponse = await axios.get(`https://api.raydium.io/orderbook/${marketAddress}`);
  const orcaResponse = await axios.get(`https://api.orca.so/v1/market/${marketAddress}`);

  let totalLiquidity = { bids: [], asks: [] };

  // Calculer la liquidité de Raydium
  if (raydiumResponse.data.data) {
    totalLiquidity.bids = raydiumResponse.data.data.bids;
    totalLiquidity.asks = raydiumResponse.data.data.asks;
  }

  // Calculer la liquidité d'Orca
  if (orcaResponse.data) {
    totalLiquidity.bids.push(...orcaResponse.data.bids);
    totalLiquidity.asks.push(...orcaResponse.data.asks);
  }

  return totalLiquidity;
}

async function performSandwich(pair, amountToBuy, dex) {
  const wallet = /* Initialisez votre portefeuille ici, par exemple, en utilisant un keypair */;
  const tokenMint = pair.baseMint;

  try {
    const dex = /* 'orca' ou 'raydium', selon votre logique */;

    const currentPrice = await getCurrentPrice(pair.address);
    const slippage = 0.01; // 1% de slippage
    const minAmountOut = (1 - slippage) * amountToBuy * currentPrice;

    console.log(`Achat de ${amountToBuy} ${tokenMint} sur ${dex} pour la paire: ${pair.address}`);
    await buyToken(wallet, tokenMint, amountToBuy, minAmountOut, pair.address, dex);

    await new Promise(resolve => setTimeout(resolve, 5000)); // Pause de 5 secondes

    const newPrice = await getCurrentPrice(pair.address);
    const amountToSell = amountToBuy; // Vendre la même quantité achetée
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
