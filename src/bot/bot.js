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

// Configuration
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const PRIVATE_KEY = Uint8Array.from([/* insère ici ta clé privée en format Uint8Array */]);
const KEYPAIR = Keypair.fromSecretKey(PRIVATE_KEY);
const SERUM_MARKET_ADDRESS = new PublicKey('9wFFe2ecmB1nPuU5H9xqg6d9eM6NLpS2eSCJih1t8TgP'); // Remplace par l'adresse de ton marché Serum
const RAYDIUM_PROGRAM_ID = new PublicKey('5quB5sHUnKccLNSKk2d5BfhTyHt4vHMmdHhRPi7YBZZM'); // Remplace par l'ID du programme Raydium
const ORCA_PROGRAM_ID = new PublicKey('9Ww2WNs2CmqKNF1rNKEKr4fqHacBjDcqNuGxvSzzcDVU'); // Remplace par l'ID du programme Orca
const RAYDIUM_API_URL = 'https://api.raydium.io/pairs'; // URL API de Raydium
const ORCA_API_URL = 'https://api.orca.so/v1/pairs'; // URL API d'Orca
const { Orca, Network } = require('@orca-so/sdk');
const MIN_LIQUIDITY_THRESHOLD = 1000; // Liquidité minimum pour déclencher une action

// Seuils centralisés
const thresholds = {
    minLiquidity: 1000, // Seuil de liquidité minimum
    priceChange: 0.05,   // Changement de prix acceptable (5%)
};

// Fonction pour scanner Serum
async function scanSerum() {
    try {
        const market = await Market.load(connection, SERUM_MARKET_ADDRESS, {}, 'serum');
        const bids = await market.loadBids(connection);
        const asks = await market.loadAsks(connection);

        console.log(`Serum Market Loaded: ${market.address.toBase58()}`);
        console.log(`Bids: ${bids.getL2(5)}`); // Affiche les 5 meilleures offres
        console.log(`Asks: ${asks.getL2(5)}`); // Affiche les 5 meilleures demandes

        // Vérifier la liquidité
        const totalBidLiquidity = bids.getL2(5).reduce((total, [price, size]) => total + size.toNumber(), 0);
        const totalAskLiquidity = asks.getL2(5).reduce((total, [price, size]) => total + size.toNumber(), 0);

        if (totalBidLiquidity < MIN_LIQUIDITY_THRESHOLD || totalAskLiquidity < MIN_LIQUIDITY_THRESHOLD) {
            console.log(`Liquidité insuffisante sur le marché ${market.address.toBase58()}`);
            return; // Sortir si la liquidité est insuffisante
        }

        // Vérifier si une transaction est front-runable
        const potentialFrontRun = checkForFrontRun(bids, asks);
        if (potentialFrontRun) {
            await executeFrontRun(potentialFrontRun, 'serum', market);
        }
    } catch (error) {
        console.error("Erreur lors du scan du marché Serum:", error);
    }
}


// Fonction pour scanner Raydium
async function scanRaydium() {
    try {
        const response = await axios.get(RAYDIUM_API_URL);

        // Vérification si les données sont valides
        if (!response.data || !Array.isArray(response.data)) {
            console.error("Données invalides reçues de l'API Raydium");
            return;
        }

        // Filtrer les paires contenant SOL
        const pairs = response.data.filter(pair => pair.tokenA === 'SOL' || pair.tokenB === 'SOL');

        console.log(`Raydium Pairs Loaded: ${pairs.length}`);
        for (const pair of pairs) {
            // Vérifiez la liquidité de la paire ici si nécessaire
            const totalLiquidity = pair.liquidity || 0; // Assurez-vous que 'liquidity' est défini dans l'objet `pair`
            if (totalLiquidity <  MIN_LIQUIDITY_THRESHOLD) {
                console.log(`Liquidité insuffisante pour la paire ${pair.tokenA}/${pair.tokenB}`);
                continue; // Passer à la prochaine paire
            }

            const potentialFrontRun = checkForRaydiumOpportunity(pair, thresholds);
            if (potentialFrontRun) {
                await executeFrontRun(potentialFrontRun, 'raydium', pair);
            }
        }
    } catch (error) {
        console.error("Erreur en scannant Raydium:", error);
    }
}


// Fonction pour scanner Orca
async function scanOrca() {
    try {
        const response = await axios.get(ORCA_API_URL);

        // Vérification si les données sont valides
        if (!response.data || !Array.isArray(response.data)) {
            console.error("Données invalides reçues de l'API Orca");
            return;
        }

        // Filtrer les paires contenant SOL
        const pairs = response.data.filter(pair => pair.tokenA === 'SOL' || pair.tokenB === 'SOL');

        console.log(`Orca Pairs Loaded: ${pairs.length}`);
        for (const pair of pairs) {
            // Vérifiez la liquidité de la paire ici si nécessaire
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


// Vérifier les opportunités de front-running pour Serum
function checkForFrontRun(bids, asks) {
    const highestBid = bids.getL2(1)[0]; // Meilleure offre
    const lowestAsk = asks.getL2(1)[0]; // Meilleure demande

    // Vérifie si nous avons à la fois la meilleure offre et la meilleure demande
    if (highestBid && lowestAsk) {
        // Compare les prix
        if (highestBid.price > lowestAsk.price) {
            console.log(`Opportunité de front-running détectée sur Serum! Offre: ${highestBid.price}, Demande: ${lowestAsk.price}`);
            return {
                price: lowestAsk.price, // Prix à utiliser pour la transaction de front-run
                amount: 1, // Quantité à acheter (ajuste selon tes besoins)
            };
        } else {
            console.log(`Aucune opportunité de front-running. Offre: ${highestBid.price}, Demande: ${lowestAsk.price}`);
        }
    } else {
        console.log("Pas assez de données pour détecter une opportunité de front-running.");
    }

    return null;
}

// Vérifier les opportunités de front-running pour Raydium
function checkForRaydiumOpportunity(pair, thresholds) {
    const { liquidity, price } = pair; // Liquidité de la paire
    const minLiquidityThreshold = thresholds.minLiquidity; // Seuil de liquidité minimum
    const priceChangeThreshold = thresholds.priceChange; // Changement de prix acceptable (5%)

    // Vérifie la liquidité
    if (liquidity < minLiquidityThreshold) {
        console.log(`Liquidité insuffisante pour ${pair.name}`);
        return null;
    }

    const previousPrice = getPreviousPrice(pair); // À définir
    const priceChange = Math.abs(price - previousPrice) / previousPrice;

    if (priceChange > priceChangeThreshold) {
        console.log(`Opportunité de front-running détectée pour ${pair.name}: Prix actuel: ${price}, Prix précédent: ${previousPrice}`);
        return {
            price: price,
            amount: 1,
        };
    }

    return null;
}

// Vérifier les opportunités de front-running pour Orca
function checkForOrcaOpportunity(pair, thresholds) {
    const { liquidity, price } = pair; // Liquidité de la paire
    const minLiquidityThreshold = thresholds.minLiquidity; // Seuil de liquidité minimum
    const priceChangeThreshold = thresholds.priceChange; // Changement de prix acceptable (5%)

    // Vérifie la liquidité
    if (liquidity < minLiquidityThreshold) {
        console.log(`Liquidité insuffisante pour ${pair.name}`);
        return null;
    }

    const previousPrice = getPreviousPrice(pair); // À définir
    const priceChange = Math.abs(price - previousPrice) / previousPrice;

    if (priceChange > priceChangeThreshold) {
        console.log(`Opportunité de front-running détectée pour ${pair.name}: Prix actuel: ${price}, Prix précédent: ${previousPrice}`);
        return {
            price: price,
            amount: 1,
        };
    }

    return null;
}

const previousPrices = {};

function getPreviousPrice(pair) {
    const pairKey = `${pair.tokenA}-${pair.tokenB}`; // Génère une clé unique pour chaque paire

    // Si la paire n'a pas encore de prix précédents, initialiser avec le prix actuel
    if (!previousPrices[pairKey]) {
        previousPrices[pairKey] = [];
        previousPrices[pairKey].push(pair.price);
        return pair.price; // Retourne le prix actuel si pas de prix précédent
    }

    // Ajoute le prix actuel à la liste des prix précédents
    previousPrices[pairKey].push(pair.price);

    // Limite le nombre de prix stockés à 10 pour éviter d'encombrer la mémoire
    if (previousPrices[pairKey].length > 10) {
        previousPrices[pairKey].shift(); // Supprime le plus ancien prix
    }

    // Calcule la moyenne des prix précédents
    const sum = previousPrices[pairKey].reduce((acc, price) => acc + price, 0);
    return sum / previousPrices[pairKey].length; // Retourne la moyenne des prix précédents
}

// Fonction pour exécuter une transaction de front-running
async function executeFrontRun(order, dex, marketOrPair) {
    console.log(`Executing front-run transaction on ${dex} at price: ${order.price} for amount: ${order.amount}`);

    // Récupérer le solde actuel de ton portefeuille
    const walletBalance = await getWalletBalance(); // Fonction à définir qui récupère le solde en SOL
    const maxPurchaseAmount = walletBalance * 0.1; // Limite d'achat à 10% du solde total (ajuste ce pourcentage selon ton besoin)

    // Limiter l'achat au montant maximum défini
    let purchaseAmount = order.amount;
    if (purchaseAmount > maxPurchaseAmount) {
        purchaseAmount = maxPurchaseAmount;
        console.log(`Limiting purchase amount to ${purchaseAmount} SOL based on wallet balance.`);
    }

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

async function getWalletBalance() {
    try {
        const balance = await connection.getBalance(KEYPAIR.publicKey); // Récupère le solde en lamports
        return balance / LAMPORTS_PER_SOL; // Convertir les lamports en SOL
    } catch (error) {
        console.error("Erreur lors de la récupération du solde:", error);
        return 0;
    }
}

async function executeRaydiumSwap(amountIn, amountOutMin, fromMint, toMint) {
    const transaction = new Transaction();

    // Obtenir le pool Raydium pour la paire SOL/SOL
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
        slippage: 0.5, // Ajuste selon ton appétit au risque
    });

    transaction.add(swapInstruction);
    return transaction;
}

async function executeOrcaSwap(amountIn, fromMint, toMint) {
    try {
        const orca = Orca.build({ network: Network.MAINNET, connection });
        const pool = await orca.getPool(fromMint, toMint);

        const transaction = new Transaction();
        const swapInstruction = await pool.swap({
            amountIn,
            slippage: 0.5, // Adjust based on your risk appetite
            userPublicKey: KEYPAIR.publicKey,
            // Add other necessary parameters if required
        });

        transaction.add(swapInstruction);

        // Sign the transaction with your wallet's keypair
        const signedTransaction = await connection.sendTransaction(transaction, [KEYPAIR]);

        // Confirm the transaction
        await connection.confirmTransaction(signedTransaction);

        console.log('Swap executed successfully:', signedTransaction);
        return signedTransaction; // or any result you want to return
    } catch (error) {
        console.error('Error executing swap:', error);
        throw error; // or handle the error as needed
    }
}

async function executeSerumSwap(marketOrPair, purchaseAmount, orderPrice) {
    try {
        const market = marketOrPair;

        // Récupérer le compte des ordres ouverts pour l'utilisateur
        const openOrdersAccount = await OpenOrders.findForMarketAndOwner(
            connection,
            market.address,
            KEYPAIR.publicKey
        );

        // Valider le compte des ordres ouverts
        if (!openOrdersAccount || openOrdersAccount.length === 0) {
            console.error('Compte des ordres ouverts introuvable');
            return;
        }

        // Valider les paramètres de l'ordre
        if (!orderPrice || orderPrice <= 0) {
            console.error('Prix invalide pour l\'ordre');
            return;
        }
        if (!purchaseAmount || purchaseAmount <= 0) {
            console.error('Montant d\'achat invalide');
            return;
        }

        // Créer la transaction
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

        // Envoyer et confirmer la transaction
        const signedTransaction = await connection.sendTransaction(transaction, [KEYPAIR]);
        await connection.confirmTransaction(signedTransaction);

        console.log('Ordre placé avec succès :', signedTransaction);
    } catch (error) {
        console.error('Erreur lors du placement de l\'ordre :', error);
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