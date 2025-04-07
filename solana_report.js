const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const axios = require("axios"); // For making HTTP requests to CoinGecko API
const minimist = require("minimist"); // For parsing command-line arguments
const express = require("express");

// Solana RPC endpoint (you can use a public endpoint or your own node)
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

const args = minimist(process.argv.slide(2),{
    alias: {
        h: "help",
        n: "numSlots",
        d: "delay",
    },
    default: {
        delay : 2
    },
});
if (args.help) {
    console.log(`
        Usage: node solana_report.js [options]
        Options:
            -h, --help          Show this help message
            -n, --numSamples    Number of slots to analyze (required)
            -d, --delay         Delay between slot fetches in seconds (default: 2)
    `);
    process.exit(0);
}

const numSlots = parseInt(args.numSamples || args.n, 10);
const delay = parseInt(args.delay || args.d, 10)*1000;
if (isNaN(numSamples) || numSamples < 1) {
    console.error("Error: Please specify a valid number of slots using -n or --numSamples.");
    process.exit(1);
}


// CoinGecko API endpoint for Solana price in USD
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

//Tracking & Time 
let currentEpoch = null; 
let latsSupply = null;
let epochStartTime = null;
let currentInflationRate = null;
const supplyData = [];
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

async function fetchInflationRate(){
    try {
        const inflationRate = await connection.getInflationRate();
        currentInflationRate = inflationRate.value;
        console.log(`Fetched inflation rate: ${currentInflationRate * 100}% annually`);
        return currentInflationRate;
    } catch (error) {
        console.error("Error fetching inflation rate:", error);
        return 0.04624; // Fallback to approximate value mannually
    }
}



const numSamples = parseInt(args.numSamples, 10);
const storageFormat = args.storage;

// Validate the storage format
if (storageFormat !== "db" && storageFormat !== "csv") {
    console.error("Error: Invalid storage format. Use 'db' or 'csv'.");
    process.exit(1);
}


// Function to fetch the current Solana price in USD
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

// Function to check if a transaction is a voting transaction
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

// Function to calculate the nth percentile of an array
function calculatePercentile(sortedArray, percentile) { 
    if (sortedArray.length === 0) return 0; 
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1; 
    return sortedArray[Math.max(0, index)]; 
} 

// Function to print a report for the current batch of blocks
function printReport(
    startSlot,
    endSlot,
    totalTransactions,
    averageTPS,
    maxFee,
    averageFee,
    medianFee,
    maxCU,
    averageCU,
    medianCU,
    averageSuccessCU,
    ComputeUnitPrice,
    ComputeUnitPriceSuccess,
    averageBlockRewards,
    averageSeigniorage,
    solPriceUSD
) {
    console.log(`\n--- Report for Slots ${startSlot} to ${endSlot} ---`);
    console.log(`Total Non-Voting Transactions: ${totalTransactions}`);
    console.log(`Average TPS: ${averageTPS.toFixed(2)}`);
    console.log(`Max Fee (SOL): ${maxFee.toFixed(6)} ($${(maxFee * solPriceUSD).toFixed(2)})`);
    console.log(`Average Fee (SOL): ${averageFee.toFixed(6)} ($${(averageFee * solPriceUSD).toFixed(2)})`);
    console.log(`Median Fee (SOL): ${medianFee.toFixed(6)} ($${(medianFee * solPriceUSD).toFixed(2)})`);
    console.log(`Max Compute Units (CU): ${maxCU}`);
    console.log(`Average Compute Units (CU): ${averageCU.toFixed(2)}`);
    console.log(`Median Compute Units (CU): ${medianCU}`);
    console.log(`Average Compute Units of Successful Tx (CU): ${averageSuccessCU}`);
    console.log(`Compute Unit Price of all Tx (SOL): ${ComputeUnitPrice}`);
    console.log(`Compute Unit Price of Successful Tx (SOL): ${ComputeUnitPriceSuccess}`);
    console.log(`Average Block Rewards (SOL): ${averageBlockRewards}`);
    console.log(`Average Seigniorage (SOL): ${averageSeigniorage}`);
    console.log(`Solana Price (USD): ${solPriceUSD.toFixed(2)}`);
    console.log("--------------------------------------------\n");
}

// Function to save data to the database or CSV file
function saveData(
    startSlot,
    endSlot,
    totalTransactions,
    averageTPS,
    maxFee,
    averageFee,
    medianFee,
    maxCU,
    averageCU,
    medianCU,
    averageSuccessCU,
    ComputeUnitPrice,
    ComputeUnitPriceSuccess,
    averageBlockRewards,
    averageSeigniorage,
    solPriceUSD
) {
    const csvRow = `${startSlot},${endSlot},${totalTransactions},${averageTPS},${maxFee},${averageFee},${medianFee},${maxCU},${averageCU},${medianCU},${averageSuccessCU},${ComputeUnitPrice},${ComputeUnitPriceSuccess},${averageBlockRewards},${averageSeigniorage},${solPriceUSD}\n`;
    fs.appendFileSync("solana_data.csv", csvRow);
    console.log(`Data for slots ${startSlot} to ${endSlot} appended to CSV file.`);
}

// Function to fetch a range of blocks and analyze priority fees
async function analyzePriorityFees(numSamples, delay) {
    try {
        const connection = new Connection(RPC_ENDPOINT, "confirmed");
        const latestSlot = await connection.getSlot();
        console.log(`Latest slot: ${latestSlot}`);

        let currentSlot = latestSlot;

        for (let i = 0; i < numSamples; i++) {
            console.log(`Fetching data for slot: ${currentSlot}`);

            // Fetch total SOL supply
            const supply = await connection.getSupply({ commitment: "confirmed" });
            const totalSolSupply = supply.value.total / LAMPORTS_PER_SOL;
            console.log(`Total SOL Supply at slot ${currentSlot}: ${totalSolSupply.toFixed(2)} SOL`);

            // Fetch SOL price
            const solPriceUSD = await getSolanaPriceInUSD();
            if (!solPriceUSD) {
                console.log("Unable to fetch Solana price. Skipping USD conversions.");
                return;
            }

            // Fetch block data
            const block = await connection.getBlock(currentSlot, { // Fixed 'slot' to 'currentSlot'
                maxSupportedTransactionVersion: 0,
                transactionDetails: "full",
                rewards: true,
            });

            if (!block) {
                console.log(`No block data for slot ${currentSlot}. Skipping.`);
                currentSlot -= 1;
                continue;
            }

            // Transaction analysis
            let totalNonVotingTransactions = 0;
            let totalSuccessfulTxs = 0;
            let totalFailedTxs = 0;
            const priorityFees = [];
            const successPriorityFees = [];
            const failedPriorityFees = [];
            const computeUnits = [];
            const successComputeUnits = [];
            const failedComputeUnits = [];
            const blockRewards = block.rewards ? block.rewards.map(r => r.lamports / LAMPORTS_PER_SOL) : [];
            const seigniorage = []; // Placeholder, requires validator-specific data

            block.transactions.forEach((tx) => {
                if (!isVotingTransaction(tx)) {
                    const meta = tx.meta;
                    if (meta && meta.fee !== undefined) {
                        totalNonVotingTransactions++; // Count all non-voting txs
                        const feeInSOL = meta.fee / LAMPORTS_PER_SOL;

                        if (feeInSOL > 0) { // Filter for positive fees
                            priorityFees.push(feeInSOL);
                            if (meta.computeUnitsConsumed !== undefined) {
                                computeUnits.push(meta.computeUnitsConsumed); // All non-voting txs with fee > 0
                            }
                            if (meta.err === null && meta.computeUnitsConsumed !== undefined) {
                                // Successful non-voting tx with fee > 0 and CU defined
                                successPriorityFees.push(feeInSOL);
                                totalSuccessfulTxs++;
                                successComputeUnits.push(meta.computeUnitsConsumed);
                            } else {
                                // Failed non-voting tx with fee > 0 (or no CU for successful)
                                failedPriorityFees.push(feeInSOL);
                                totalFailedTxs++;
                                failedComputeUnits.push(meta.computeUnitsConsumed || 0); // Default to 0 if undefined
                            }
                        }
                    }
                }
            });

            if (priorityFees.length === 0) {
                console.log(`No priority fees found in slot ${currentSlot}.`);
            }

            // Fee Analysis
            const sortedFees = priorityFees.sort((a, b) => a - b);
            const maxFee = sortedFees[sortedFees.length - 1] || 0;
            const averageFee = sortedFees.length ? sortedFees.reduce((sum, fee) => sum + fee, 0) / sortedFees.length : 0;
            const medianFee = sortedFees.length
                ? sortedFees.length % 2 === 0
                    ? (sortedFees[sortedFees.length / 2 - 1] + sortedFees[sortedFees.length / 2]) / 2
                    : sortedFees[Math.floor(sortedFees.length / 2)]
                : 0;

            // CU Analysis
            const sortedComputeUnits = computeUnits.sort((a, b) => a - b);
            const sortedSuccessCU = successComputeUnits.sort((a, b) => a - b);
            const maxCU = sortedComputeUnits[sortedComputeUnits.length - 1] || 0;
            const averageCU = computeUnits.length ? computeUnits.reduce((sum, cu) => sum + cu, 0) / computeUnits.length : 0;
            const medianCU = computeUnits.length
                ? computeUnits.length % 2 === 0
                    ? (sortedComputeUnits[computeUnits.length / 2 - 1] + sortedComputeUnits[computeUnits.length / 2]) / 2
                    : sortedComputeUnits[Math.floor(computeUnits.length / 2)]
                : 0;
            const averageSuccessCU = sortedSuccessCU.length ? sortedSuccessCU.reduce((sum, cu) => sum + cu, 0) / sortedSuccessCU.length : 0;

            // Tx Analysis
            const blockTime = block.blockTime ? (block.blockTime - (block.parentSlot ? block.parentSlot : 0)) / 1000 : 0.4; // Default to 0.4s if no timestamp
            const averageTPS = blockTime ? totalNonVotingTransactions / blockTime : 0;

            // Reward Analysis
            const sortedBlockRewards = blockRewards.sort((a, b) => a - b);
            const averageBlockRewards = sortedBlockRewards.length
                ? sortedBlockRewards.reduce((sum, reward) => sum + reward, 0) / sortedBlockRewards.length
                : 0;
            const sortedSeigniorage = seigniorage.sort((a, b) => a - b);
            const averageSeigniorage = sortedSeigniorage.length
                ? sortedSeigniorage.reduce((sum, seig) => sum + seig, 0) / sortedSeigniorage.length
                : 0;

            // CUP Analysis
            const totalFees = priorityFees.reduce((sum, fee) => sum + fee, 0);
            const totalSuccessFees = successPriorityFees.reduce((sum, fee) => sum + fee, 0);
            const totalComputeUnits = computeUnits.reduce((sum, cu) => sum + cu, 0);
            const totalSuccessCU = successComputeUnits.reduce((sum, cu) => sum + cu, 0);
            const ComputeUnitPrice = computeUnits.length > 0 ? totalFees / totalComputeUnits : 0;
            const ComputeUnitPriceSuccess = successComputeUnits.length > 0 ? totalSuccessFees / totalSuccessCU : 0;

            // Print and save report
            printReport(
                currentSlot,
                currentSlot,
                totalNonVotingTransactions,
                averageTPS,
                maxFee,
                averageFee,
                medianFee,
                maxCU,
                averageCU,
                medianCU,
                averageSuccessCU,
                averageBlockRewards,
                averageSeigniorage,
                ComputeUnitPrice,
                ComputeUnitPriceSuccess,
                solPriceUSD,
                totalSolSupply
            );

            saveData(
                currentSlot,
                currentSlot,
                totalNonVotingTransactions,
                averageTPS,
                maxFee,
                averageFee,
                medianFee,
                maxCU,
                averageCU,
                medianCU,
                averageSuccessCU,
                averageBlockRewards,
                averageSeigniorage,
                ComputeUnitPrice,
                ComputeUnitPriceSuccess,
                solPriceUSD,
                totalSolSupply
            );

            currentSlot -= 1;
            if (i < numSamples - 1 && delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    } catch (error) {
        console.error("Error analyzing priority fees:", error);
    }
}


// Run the analysis
analyzePriorityFees(numSamples, delay);
