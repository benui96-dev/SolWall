const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { Market, OpenOrders } = require('@project-serum/serum');
const axios = require('axios');
const BN = require('bn.js');
const pLimit = require('p-limit');

const raydiumCache = {};
const serumCache = {};
const orcaCache = {};
const CACHE_EXPIRATION_TIME = 300000; // 5 minutes en millisecondes

// Configuration
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const PRIVATE_KEY = Uint8Array.from([/* insère ici ta clé privée en format Uint8Array */]);
const KEYPAIR = Keypair.fromSecretKey(PRIVATE_KEY);
const SERUM_MARKET_ADDRESS = new PublicKey('9wFFe2ecmB1nPuU5H9xqg6d9eM6NLpS2eSCJih1t8TgP'); // Remplace par l'adresse de ton marché Serum
const RAYDIUM_API_URL = 'https://api.raydium.io/pairs'; // URL API de Raydium
const ORCA_API_URL = 'https://api.orca.so/v1/pairs'; // URL API d'Orca
const { Orca, Network } = require('@orca-so/sdk');
const MIN_LIQUIDITY_THRESHOLD = 1000; // Liquidité minimum pour déclencher une action
const historicalPricesCache = {};

const thresholds = {
    minLiquidity: 1000, // Seuil de liquidité minimum
    priceChange: 0.05,   // Changement de prix acceptable (5%)
};

async function scanSerum() {
    try {
        const currentTime = Date.now();
        let bids, asks;

        if (serumCache.market && (currentTime - serumCache.timestamp < CACHE_EXPIRATION_TIME)) {
            console.log("Utilisation des données mises en cache pour Serum.");
            bids = serumCache.market.bids;
            asks = serumCache.market.asks;
        } else {
            const market = await Market.load(connection, SERUM_MARKET_ADDRESS, {}, 'serum');
            bids = await market.loadBids(connection);
            asks = await market.loadAsks(connection);

            console.log(`Serum Market Loaded: ${market.address.toBase58()}`);
            console.log(`Bids: ${bids.getL2(5)}`); // Affiche les 5 meilleures offres
            console.log(`Asks: ${asks.getL2(5)}`); // Affiche les 5 meilleures demandes

            serumCache.market = {
                bids: bids,
                asks: asks,
            };
            serumCache.timestamp = Date.now();
        }

        const totalBidLiquidity = bids.getL2(5).reduce((total, [price, size]) => total + size.toNumber(), 0);
        const totalAskLiquidity = asks.getL2(5).reduce((total, [price, size]) => total + size.toNumber(), 0);

        if (totalBidLiquidity < MIN_LIQUIDITY_THRESHOLD || totalAskLiquidity < MIN_LIQUIDITY_THRESHOLD) {
            console.log(`Liquidité insuffisante sur le marché ${SERUM_MARKET_ADDRESS}`);
            return; // Sortir si la liquidité est insuffisante
        }

        // Vérifier si une transaction est front-runable
        const potentialFrontRun = checkForSerumOpportunity(bids, asks);
        if (potentialFrontRun) {
            await executeFrontRun(potentialFrontRun, 'serum', market);
        }
    } catch (error) {
        console.error("Erreur lors du scan du marché Serum:", error);
    }
}

async function scanRaydium() {
    try {
        const currentTime = Date.now();
        if (raydiumCache.data && (currentTime - raydiumCache.timestamp < CACHE_EXPIRATION_TIME)) {
            console.log("Utilisation des données mises en cache.");
            var pairs = raydiumCache.data; // Utiliser les données mises en cache
        } else {
            const response = await axios.get(RAYDIUM_API_URL);
            if (response.status !== 200) {
                console.error(`Erreur de l'API Raydium: ${response.status}`);
                return;
            }
            if (!response.data || !Array.isArray(response.data)) {
                console.error("Données invalides reçues de l'API Raydium");
                return;
            }
            pairs = response.data.filter(pair => pair.tokenA === 'SOL' || pair.tokenB === 'SOL');
            console.log(`Raydium Pairs Loaded: ${pairs.length}`);
            raydiumCache.data = pairs;
            raydiumCache.timestamp = Date.now();
        }

        const limit = pLimit(5); // Limite à 5 exécutions simultanées
        await Promise.all(pairs.map(pair => limit(async () => {
            const totalLiquidity = pair.liquidity || 0; 
            if (totalLiquidity < MIN_LIQUIDITY_THRESHOLD) {
                console.log(`Liquidité insuffisante pour la paire ${pair.tokenA}/${pair.tokenB}`);
                return; 
            }

            const potentialFrontRun = checkForRaydiumOpportunity(pair, thresholds);
            if (potentialFrontRun) {
                await executeFrontRun(potentialFrontRun, 'raydium', pair);
                console.log(`Front-run exécuté pour la paire ${pair.tokenA}/${pair.tokenB}`);
            } else {
                console.log(`Aucune opportunité de front-running pour ${pair.tokenA}/${pair.tokenB}`);
            }
        })));
    } catch (error) {
        console.error("Erreur en scannant Raydium:", error);
    }
}

async function scanOrca() {
    try {
        const currentTime = Date.now();
        let pairs;

        if (orcaCache.data && (currentTime - orcaCache.timestamp < CACHE_EXPIRATION_TIME)) {
            console.log("Utilisation des données mises en cache pour Orca.");
            pairs = orcaCache.data;
        } else {
            const response = await axios.get(ORCA_API_URL);

            if (!response.data || !Array.isArray(response.data)) {
                console.error("Données invalides reçues de l'API Orca");
                return;
            }

            pairs = response.data.filter(pair => pair.tokenA === 'SOL' || pair.tokenB === 'SOL');

            orcaCache.data = pairs;
            orcaCache.timestamp = Date.now();

            console.log(`Orca Pairs Loaded: ${pairs.length}`);
        }

        for (const pair of pairs) {
            const totalLiquidity = pair.liquidity || 0; // Assurez-vous que 'liquidity' est défini dans l'objet `pair`
            if (totalLiquidity < thresholds.minLiquidity) {
                console.log(`Liquidité insuffisante pour la paire ${pair.tokenA}/${pair.tokenB}`);
                continue; // Passer à la prochaine paire
            }

            const potentialFrontRun = checkForOrcaOpportunity(pair, thresholds);
            if (potentialFrontRun) {
                await executeFrontRun(potentialFrontRun, 'orca', pair);
            }
        }
    } catch (error) {
        console.error("Erreur en scannant Orca:", error);
    }
}

async function checkForSerumOpportunity(bids, asks, thresholds) {
    const highestBid = bids.getL2(1)[0]; // Meilleure offre
    const lowestAsk = asks.getL2(1)[0]; // Meilleure demande

    if (highestBid && lowestAsk) {
        if (highestBid.price > lowestAsk.price) {
            console.log(`Opportunité de front-running détectée sur Serum! Offre: ${highestBid.price}, Demande: ${lowestAsk.price}`);

            const prices = await getHistoricalPrices(pair);  // À définir : fonction pour récupérer les prix historiques
            console.log('Historical Prices:', prices);
            const marketSignal = await analyzeMarketData(prices);  // Analyse des indicateurs techniques (RSI, WMA)

            if (marketSignal === "buy") {
                console.log(`Opportunité d'achat détectée sur Serum! Prix: ${lowestAsk.price}`);
                return {
                    price: lowestAsk.price, // Prix à utiliser pour la transaction de front-run
                    amount: 1, // Quantité à acheter (ajuste selon tes besoins)
                };
            } else {
                console.log(`Signal d'achat non détecté sur Serum.`);
            }
        } else {
            console.log(`Aucune opportunité de front-running. Offre: ${highestBid.price}, Demande: ${lowestAsk.price}`);
        }
    } else {
        console.log("Pas assez de données pour détecter une opportunité de front-running.");
    }

    return null;
}

async function checkForRaydiumOpportunity(pair, thresholds) {
    const { liquidity, price } = pair; // Liquidité de la paire
    const minLiquidityThreshold = thresholds.minLiquidity; // Seuil de liquidité minimum
    const priceChangeThreshold = thresholds.priceChange; // Changement de prix acceptable (5%)

    if (liquidity < minLiquidityThreshold) {
        console.log(`Liquidité insuffisante pour ${pair.name}`);
        return null;
    }

    const previousPrice = getPreviousPrice(pair); // À définir : fonction pour obtenir le prix précédent
    const priceChange = Math.abs(price - previousPrice) / previousPrice;

    if (priceChange > priceChangeThreshold) {
        console.log(`Opportunité de front-running détectée pour ${pair.name}: Prix actuel: ${price}, Prix précédent: ${previousPrice}`);

        const prices = await getHistoricalPrices(pair);  // À définir : fonction pour récupérer les prix historiques
        console.log('Historical Prices:', prices);

        const marketSignal = await analyzeMarketData(prices);  // Analyse des indicateurs techniques (RSI, WMA)

        if (marketSignal === "buy") {
            console.log(`Opportunité d'achat détectée pour ${pair.name}`);
            return {
                action: "buy",
                price: price,
                amount: 1,  // Définit la quantité d'achat (à ajuster selon ta logique)
            };
        }
    }

    return null;
}

async function checkForOrcaOpportunity(pair, thresholds) {
    const { liquidity, price } = pair; // Liquidité de la paire
    const minLiquidityThreshold = thresholds.minLiquidity; // Seuil de liquidité minimum
    const priceChangeThreshold = thresholds.priceChange; // Changement de prix acceptable (5%)

    if (liquidity < minLiquidityThreshold) {
        console.log(`Liquidité insuffisante pour ${pair.name}`);
        return null;
    }

    const previousPrice = getPreviousPrice(pair); // À définir : fonction pour obtenir le prix précédent
    const priceChange = Math.abs(price - previousPrice) / previousPrice;

    if (priceChange > priceChangeThreshold) {
        console.log(`Opportunité de front-running détectée pour ${pair.name}: Prix actuel: ${price}, Prix précédent: ${previousPrice}`);

        const prices = await getHistoricalPrices(pair);  // À définir : fonction pour récupérer les prix historiques
        console.log('Historical Prices:', prices);
        const marketSignal = await analyzeMarketData(prices);  // Analyse des indicateurs techniques (RSI, WMA)

        if (marketSignal === "buy") {
            console.log(`Opportunité d'achat détectée pour ${pair.name}`);
            return {
                action: "buy",
                price: price,
                amount: 1,  // Définit la quantité d'achat (à ajuster selon ta logique)
            };
        }
    }

    return null;
}


const previousPrices = {};

function getPreviousPrice(pair) {
    const pairKey = `${pair.tokenA}-${pair.tokenB}`; // Génère une clé unique pour chaque paire

    if (!previousPrices[pairKey]) {
        previousPrices[pairKey] = [];
        previousPrices[pairKey].push(pair.price);
        return pair.price; // Retourne le prix actuel si pas de prix précédent
    }

    previousPrices[pairKey].push(pair.price);

    if (previousPrices[pairKey].length > 10) {
        previousPrices[pairKey].shift(); // Supprime le plus ancien prix
    }

    const sum = previousPrices[pairKey].reduce((acc, price) => acc + price, 0);
    return sum / previousPrices[pairKey].length; // Retourne la moyenne des prix précédents
}

async function executeFrontRun(order, dex, marketOrPair) {
    console.log(`Executing front-run transaction on ${dex} at price: ${order.price} for amount: ${order.amount}`);

    const purchaseAmount = 0.1;

    let transaction;

    switch (dex) {
        case 'serum':
			const market = marketOrPair;
			const openOrdersAccount = await OpenOrders.findForMarketAndOwner(
				connection,
				market.address,
				KEYPAIR.publicKey
			);

			if (!openOrdersAccount || openOrdersAccount.length === 0) {
				console.error('Open orders account introuvable');
				return;
			}

			// Appel de la fonction executeSerumSwap
			await executeSerumSwap(market, purchaseAmount, order.price);
			break;

        case 'raydium':
			const solMint = new PublicKey('So11111111111111111111111111111111111111112'); // Adresse du token SOL
			transaction = await executeRaydiumSwap(purchaseAmount, 0, solMint, solMint); // Swap SOL/SOL sur Raydium
			break;

		case 'orca':
			const orcaSolMint = new PublicKey('So11111111111111111111111111111111111111112'); // Adresse du token SOL
			transaction = await executeOrcaSwap(purchaseAmount, orcaSolMint, orcaSolMint); // Swap SOL/SOL sur Orca
			break;

        default:
            console.error("DEX non reconnu");
            return;
    }

    try {
        const signature = await sendAndConfirmTransaction(connection, transaction, [KEYPAIR]);
        console.log(`Transaction réussie avec le hash: ${signature}`);
    } catch (error) {
        console.error("Erreur lors de l'exécution de la transaction:", error);
    }
}

async function executeRaydiumSwap(amountIn, amountOutMin, fromMint, toMint) {
    const transaction = new Transaction();

    const { swap, getPool } = require('@raydium-io/raydium-sdk'); // Assurez-vous d'avoir le bon package pour Raydium
    const pool = await getPool(fromMint.toBase58(), toMint.toBase58());

    if (!pool) {
        console.error("Pool introuvable pour la paire donnée");
        return;
    }

    const swapInstruction = swap({
        userPublicKey: KEYPAIR.publicKey,
        amountIn,
        amountOutMin,
        fromMint,
        toMint,
        pool: pool.address, // Utiliser l'adresse du pool
        slippage: 0.5, // Ajustez selon votre tolérance au risque
    });

    transaction.add(swapInstruction);

    const signedTransaction = await connection.sendTransaction(transaction, [KEYPAIR]);
    await connection.confirmTransaction(signedTransaction);
    console.log('Swap d\'achat exécuté avec succès:', signedTransaction);

    const initialPrice = await pool.getPrice(); // Obtenez le prix initial
    let newPrice;
    const maxRetries = 10; // Nombre maximum de réessais
    let attempts = 0;

    while (attempts < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes avant de vérifier
        newPrice = await pool.getPrice(); // Obtenez le nouveau prix après l'achat
        console.log('Vérification du prix... Nouveau prix:', newPrice);

        if (newPrice > initialPrice) {
            console.log('Le prix a augmenté, prêt à vendre.');
            break; // Sortir de la boucle si le prix a augmenté
        } else {
            console.log('Le prix n\'a pas encore augmenté, réessai...');
            attempts++;
        }
    }

    if (newPrice <= initialPrice) {
        console.log('Le prix n\'a pas augmenté après plusieurs essais, vente annulée.');
        return {
            buyTransaction: signedTransaction,
            sellTransaction: null, // Aucune vente n'a eu lieu
        };
    }

    const amountOut = await pool.getAmountOut(amountIn); // Obtenez le montant à vendre basé sur l'achat
    const sellTransaction = new Transaction();
    const sellInstruction = swap({
        userPublicKey: KEYPAIR.publicKey,
        amountIn: amountOut, // Vendre le montant obtenu
        amountOutMin,
        fromMint: toMint, // Utiliser le mint de la devise achetée
        toMint: fromMint, // Vendre vers le mint de la devise d'origine
        pool: pool.address, // Utiliser l'adresse du pool
        slippage: 0.5, // Ajustez selon vos besoins
    });

    sellTransaction.add(sellInstruction);

    const signedSellTransaction = await connection.sendTransaction(sellTransaction, [KEYPAIR]);
    await connection.confirmTransaction(signedSellTransaction);
    console.log('Swap de vente exécuté avec succès:', signedSellTransaction);

    return {
        buyTransaction: signedTransaction,
        sellTransaction: signedSellTransaction, // Retourner aussi la vente
    }; 
}


async function executeOrcaSwap(amountIn, fromMint, toMint) {
    try {
        const orca = Orca.build({ network: Network.MAINNET, connection });
        const pool = await orca.getPool(fromMint, toMint);

        const transaction = new Transaction();
        const swapInstruction = await pool.swap({
            amountIn,
            slippage: 0.5, // Ajustez en fonction de votre tolérance au risque
            userPublicKey: KEYPAIR.publicKey,
        });

        transaction.add(swapInstruction);

        const signedTransaction = await connection.sendTransaction(transaction, [KEYPAIR]);
        
        await connection.confirmTransaction(signedTransaction);
        console.log('Swap d\'achat exécuté avec succès:', signedTransaction);

        const initialPrice = await pool.getPrice(); // Obtenez le prix initial
        let newPrice;
        const maxRetries = 10; // Nombre maximum de réessais
        let attempts = 0;

        while (attempts < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes avant de vérifier
            newPrice = await pool.getPrice(); // Obtenez le nouveau prix
            console.log('Vérification du prix... Nouveau prix:', newPrice);

            if (newPrice > initialPrice) {
                console.log('Le prix a augmenté, prêt à vendre.');
                break; // Sortir de la boucle si le prix a augmenté
            } else {
                console.log('Le prix n\'a pas encore augmenté, réessai...');
                attempts++;
            }
        }

        if (newPrice <= initialPrice) {
            console.log('Le prix n\'a pas augmenté après plusieurs essais, vente annulée.');
            return {
                buyTransaction: signedTransaction,
                sellTransaction: null, // Aucun vente n'a eu lieu
            };
        }

        const amountOut = await pool.getAmountOut(amountIn); // Obtenez le montant de sortie basé sur l'achat
        const sellTransaction = new Transaction();
        const sellInstruction = await pool.swap({
            amountIn: amountOut, // Vendre le montant obtenu
            slippage: 0.5, // Ajustez selon vos besoins
            userPublicKey: KEYPAIR.publicKey,
        });

        sellTransaction.add(sellInstruction);

        const signedSellTransaction = await connection.sendTransaction(sellTransaction, [KEYPAIR]);

        await connection.confirmTransaction(signedSellTransaction);
        console.log('Swap de vente exécuté avec succès:', signedSellTransaction);

        return {
            buyTransaction: signedTransaction,
            sellTransaction: signedSellTransaction, // Retourner aussi la vente
        }; 
    } catch (error) {
        console.error('Erreur lors de l\'exécution du swap:', error);
        throw error; // ou gérez l'erreur selon vos besoins
    }
}

async function executeSerumSwap(marketOrPair, purchaseAmount, orderPrice) {
    try {
        const market = marketOrPair;

        const openOrdersAccount = await OpenOrders.findForMarketAndOwner(
            connection,
            market.address,
            KEYPAIR.publicKey
        );

        if (!openOrdersAccount || openOrdersAccount.length === 0) {
            console.error('Compte des ordres ouverts introuvable');
            return;
        }

        if (!orderPrice || orderPrice <= 0) {
            console.error('Prix invalide pour l\'ordre');
            return;
        }
        if (!purchaseAmount || purchaseAmount <= 0) {
            console.error('Montant d\'achat invalide');
            return;
        }

        const transaction = new Transaction().add(
            market.makePlaceOrderInstruction(
                connection,
                {
                    owner: KEYPAIR.publicKey,
                    payer: market.quoteWallet, // Compte pour les fonds
                    side: 'buy',
                    price: orderPrice,
                    size: purchaseAmount, // Utilise le montant d'achat
                    orderType: 'limit',
                    clientId: new BN(Date.now()), // ID client pour la traçabilité
                    openOrdersAddress: openOrdersAccount[0].address, // Assurez-vous que cet index est correct
                }
            )
        );

        const signedTransaction = await connection.sendTransaction(transaction, [KEYPAIR]);
        await connection.confirmTransaction(signedTransaction);
        console.log('Ordre d\'achat placé avec succès :', signedTransaction);

        const initialPrice = orderPrice; // Le prix initial est celui que vous avez fixé
        let newPrice;
        const maxRetries = 10; // Nombre maximum de réessais
        let attempts = 0;

        while (attempts < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes avant de vérifier
            newPrice = await market.loadBestBid(); // Obtenez le nouveau prix (ou un autre moyen de vérifier le prix)
            console.log('Vérification du prix... Nouveau prix:', newPrice);

            if (newPrice > initialPrice) {
                console.log('Le prix a augmenté, prêt à vendre.');
                break; // Sortir de la boucle si le prix a augmenté
            } else {
                console.log('Le prix n\'a pas encore augmenté, réessai...');
                attempts++;
            }
        }

        if (newPrice <= initialPrice) {
            console.log('Le prix n\'a pas augmenté après plusieurs essais, vente annulée.');
            return {
                buyTransaction: signedTransaction,
                sellTransaction: null, // Aucun vente n'a eu lieu
            };
        }

        const sellTransaction = new Transaction().add(
            market.makePlaceOrderInstruction(
                connection,
                {
                    owner: KEYPAIR.publicKey,
                    payer: market.quoteWallet, // Compte pour les fonds
                    side: 'sell',
                    price: newPrice, // Vendre au nouveau prix
                    size: purchaseAmount, // Vendre le montant acheté
                    orderType: 'limit',
                    clientId: new BN(Date.now()), // ID client pour la traçabilité
                    openOrdersAddress: openOrdersAccount[0].address, // Assurez-vous que cet index est correct
                }
            )
        );

        const signedSellTransaction = await connection.sendTransaction(sellTransaction, [KEYPAIR]);
        await connection.confirmTransaction(signedSellTransaction);
        console.log('Ordre de vente exécuté avec succès :', signedSellTransaction);

        return {
            buyTransaction: signedTransaction,
            sellTransaction: signedSellTransaction, // Retourner aussi la vente
        }; 
    } catch (error) {
        console.error('Erreur lors du placement de l\'ordre :', error);
    }
}


function calculateWMA(prices, period) {
    const weights = Array.from({ length: period }, (_, i) => i + 1); // [1, 2, ..., period]
    const weightedPrices = prices.slice(-period).map((price, index) => price * weights[index]);
    
    const wma = weightedPrices.reduce((acc, price) => acc + price, 0) / weights.reduce((acc, weight) => acc + weight, 0);
    return wma;
}

function calculateRSI(prices, period) {
    if (prices.length < period) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            gains += change;
        } else {
            losses -= change; // perdre est positif
        }
    }

    const averageGain = gains / period;
    const averageLoss = losses / period;

    if (averageLoss === 0) return 100; // éviter la division par zéro

    const rs = averageGain / averageLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

async function analyzeMarketData(prices) {
    const wmaPeriod = 14;  // Période pour la WMA
    const rsiPeriod = 14;  // Période pour le RSI

    const wma = calculateWMA(prices, wmaPeriod);  // Fonction pour calculer la WMA
    const rsi = calculateRSI(prices, rsiPeriod);  // Fonction pour calculer le RSI

    console.log(`WMA: ${wma}, RSI: ${rsi}`);

    if (rsi < 30) {
        console.log("RSI indique une condition de survente - potentiel d'achat.");
        return "buy";
    }

    return null;  // Pas de signal clair de trading
}

async function getHistoricalPrices(coinId, days = 30) {
    const cacheKey = `${coinId}_${days}`; // Créer une clé unique pour chaque coin et période
    const cachedPrices = historicalPricesCache[cacheKey]; // Vérifier si les prix sont déjà dans le cache

    if (cachedPrices) {
        console.log('Returning cached prices for:', cacheKey);
        return cachedPrices; // Retourner les prix du cache s'ils existent
    }

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        // Extraire les prix de la réponse
        const prices = data.prices.map(price => price[1]); // Chaque élément contient [timestamp, price]

        // Stocker les prix dans le cache
        historicalPricesCache[cacheKey] = prices;
        console.log('Fetched and cached prices for:', cacheKey);
        
        return prices;
    } catch (error) {
        console.error('Error fetching historical prices:', error);
        return []; // Retourner un tableau vide en cas d'erreur
    }
}

async function mainLoop() {
    while (true) {
        await scanSerum();
        await scanRaydium();
        await scanOrca();
        await new Promise(resolve => setTimeout(resolve, 10000)); // Pause de 10 secondes avant le prochain scan
    }
}

mainLoop().catch(console.error);
