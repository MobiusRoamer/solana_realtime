const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const axios = require("axios"); 
const minimist = require("minimist"); 
const express = require("express");

const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL_CONST = 1000000000;
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";


const args = minimist(process.argv.slice(2),{
    alias: {
        h: "help",
        n: "numBlocks",
        d: "delay",
    },
    default: {
        delay : 2
    },
});
if (args.help) {
    console.log(`
        Usage: node solana_realtime.js [options]
        Options:
            -h, --help          Show this help message
            -n, --numBlocks    Number of slots to analyze (required)
            -d, --delay         Delay between slot fetches in seconds (default: 2)
    `);
    process.exit(0);
}

const numBlocks = parseInt(args.numBlocks || args.n, 10);
const delay = parseInt(args.delay || args.d, 10)*1000;

const connection = new Connection(RPC_ENDPOINT, "confirmed");

if (isNaN(numBlocks) || numBlocks < 1) {
    console.error("Error: Please specify a valid number of slots using -n or --numBlocks.");
    process.exit(1);
}

async function getSolanaPriceInUSD() {
    try {
        const response = await axios.get(COINGECKO_API_URL);
        const solanaPrice = response.data.solana.usd;
        return solanaPrice;
    } catch (error) {
        console.error("Error fetching Solana price:", error);
        return null;
    }
}

function isVotingTransaction(transaction) {
    const VOTE_PROGRAM_ID = "Vote111111111111111111111111111111111111111";
    const STAKE_PROGRAM_ID = "Stake11111111111111111111111111111111111111";

    try {
        const accountKeys = transaction.transaction?.message?.accountKeys;
        if (!accountKeys || !Array.isArray(accountKeys)) {
            return false;
        }
        return accountKeys.some(
            (account) =>
                account.toString() === VOTE_PROGRAM_ID ||
                account.toString() === STAKE_PROGRAM_ID
        );
    } catch (error) {
        console.error("Error checking voting transaction:", error);
        return false;
    }
}

async function analyzeBlock(slotNumber){
    try {
        const block = await connection.getBlock(slotNumber, { 
            maxSupportedTransactionVersion: 0,
            transactionDetails: "full",
            rewards: false,
        });
        if (!block || !block.transactions || !Array.isArray(block.transactions)) {
            console.log(`No block data for slot ${slotNumber}. Skipping.`);
            return null;
        }
        
        // Initialize
        let totalFeesAll = 0;
        let totalComputeUnitsAll = 0;
        let txCountAll = 0;
        let totalFeesSuccess = 0;
        let totalComputeUnitsSuccess = 0;
        let txCountSuccess = 0;

        block.transactions.forEach((tx) => {
            if (!isVotingTransaction(tx)) {
                const meta = tx.meta;
                if (meta && meta.fee !== undefined) {
                    const feeInSOL = meta.fee / LAMPORTS_PER_SOL_CONST;
                    const computeUnits = meta.computeUnitsConsumed || 0;

                    totalFeesAll += feeInSOL;
                    totalComputeUnitsAll += computeUnits;
                    txCountAll ++;

                    if(meta.err === null){
                        totalFeesSuccess += feeInSOL;
                        totalComputeUnitsSuccess += computeUnits;
                        txCountSuccess ++;
                    }
                }
            }
        });
        const avgFeeAll = txCountAll >0 ? totalFeesAll / txCountAll : 0;
        const avgComputeUnitPriceAll = totalComputeUnitsAll >0 ? totalFeesAll / totalComputeUnitsAll : 0;
        const avgFeeSuccess = txCountSuccess >0 ? totalFeesSuccess / txCountSuccess : 0;
        const avgComputeUnitPriceSuccess = totalComputeUnitsSuccess >0 ? totalFeesSuccess / totalComputeUnitsSuccess :0;

        return{
            slot: slotNumber,
            avgFeeAll: avgFeeAll,
            avgComputeUnitPriceAll: avgComputeUnitPriceAll,
            avgFeeSuccess : avgFeeSuccess, 
            avgComputeUnitPriceSuccess: avgComputeUnitPriceSuccess, 
            timestamp: block.blockTime ? new Date(block.blockTime*1000).toISOString(): new Date().toISOString(),
        };
    }catch(error){
        console.error(`Error fetching block data for slot ${slotNumber}:`, error.message);
        return null;
    }
}

const app = express();
const port = 3000; 
let blockData = [];

async function fetchLatestData() {
    const latestSlot = await connection.getSlot();
    const data = await analyzeBlock(latestSlot);
    if(data) {
        blockData.push(data);
        console.log(
            `
            -------------------------------------------------
            Slot ${data.slot}
            Avg Fee (All) = ${data.avgFeeAll.toFixed(6)} SOL,
            Avg Compute Unit Price (All) = ${data.avgComputeUnitPriceAll.toFixed(6)} SOL,
            Avg Fee (Successful Tx) = ${data.avgFeeSuccess.toFixed(6)} SOL,
            Avg Compute Unit Price (Succeessful Tx) = ${data.avgComputeUnitPriceSuccess.toFixed(6)} SOL
            -------------------------------------------------
            `
        )
    }
}

async function initializeData() {
    let slot = await connection.getSlot();
    for (let i =0; i<numBlocks; i++){
        const data = await analyzeBlock(slot - i);
        if (data) {
            blockData.push(data);
        }
        await new Promise((resolve)=>setTimeout(resolve, delay));
    }
    console.log(`Initialized with ${blockData.length} samples`);
}

app.get("/data", (req, res)=>{
    res.json(blockData);
});


app.use(express.static(__dirname));


initializeData().then(()=> {
    app.listen(port, ()=> {
        console.log(`Server running at http://localhost:${port}`);
    });

    setInterval(async () => { 
        await fetchLatestData();

        if (blockData.length > 500) blockData.shift();
    }, delay);
}).catch((error) => {
    console.error("Initialization failed", error);
    process.exit(1);
});



