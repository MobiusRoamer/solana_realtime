const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const axios = require("axios"); // For making HTTP requests to CoinGecko API
const fs = require("fs"); // For CSV file operations
const minimist = require("minimist"); // For parsing command-line arguments

// Solana RPC endpoint (you can use a public endpoint or your own node)
const RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";

// CoinGecko API endpoint for Solana price in USD
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

// Parse command-line arguments
const args = minimist(process.argv.slice(2), {
    alias: {
        h: "help",
        n: "numSamples",
        s: "storage",
        b: "batchSize",
        d: "delay",
    },
    default: {
        storage: "csv", // Default to CSV database
        batchSize: 10, // Default batch size is 10 blocks
        delay: 2, // Default delay is 2 seconds
    },
});

// Display help output if -h or --help is provided
if (args.help) {
    console.log(`
Usage: node solana-fee-report.js [options]

Options:
  -h, --help          Show this help message and exit
  -n, --numSamples    Number of block batches to analyze (e.g., -n 1000)
  -s, --storage       Storage format: 'db' for SQLite3 database or 'csv' for CSV file (default: db)
  -b, --batchSize     Number of blocks per batch (1 to 100, default: 10)
  -d, --delay         Delay in seconds between block fetches (default: 2)

Example:
  node solana-fee-report.js -n 1000 -s csv -b 20 -d 5
`);
    process.exit(0);
}

// Validate the number of samples
if (!args.numSamples || isNaN(args.numSamples)) {
    console.error("Error: Please specify the number of block batches using -n or --numSamples.");
    process.exit(1);
}

const numSamples = parseInt(args.numSamples, 10);
const storageFormat = args.storage;

// Validate the storage format
if (storageFormat !== "db" && storageFormat !== "csv") {
    console.error("Error: Invalid storage format. Use 'db' or 'csv'.");
    process.exit(1);
}

// Validate the batch size
const batchSize = parseInt(args.batchSize, 10);
if (isNaN(batchSize) || batchSize < 1 || batchSize > 100) {
    console.error("Error: Batch size must be between 1 and 100.");
    process.exit(1);
}

// Validate the delay
const delay = parseInt(args.delay, 10);
if (isNaN(delay) || delay < 0) {
    console.error("Error: Delay must be a non-negative number.");
    process.exit(1);
}


// Initialize CSV file (no sqlite3)
const csvHeader = "start_slot,end_slot,total_transactions,average_tps,max_fee_sol,average_fee_sol,median_fee_sol,max_cu,average_cu,median_cu,sol_price_usd\n";
//need to delete: percentiles95_fee_sol
fs.writeFileSync("solana_data.csv", csvHeader); // Creates or overwrites the CSV with headers

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
function calculatePercentile(sortedArray, percentile) { //delete
    if (sortedArray.length === 0) return 0; //delete
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1; //delete
    return sortedArray[Math.max(0, index)]; //delete
} //delete

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
    console.log(`Solana Price (USD): $${solPriceUSD.toFixed(2)}`);
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
    solPriceUSD
) {
    const csvRow = `${startSlot},${endSlot},${totalTransactions},${averageTPS},${maxFee},${averageFee},${medianFee},${percentile95Fee},${maxCU},${averageCU},${medianCU},${solPriceUSD}\n`;
    fs.appendFileSync("solana_data.csv", csvRow);
    console.log(`Data for slots ${startSlot} to ${endSlot} appended to CSV file.`);
}

// Function to fetch a range of blocks and analyze priority fees
async function analyzePriorityFees(numSamples, batchSize, delay) {
    try {
        const connection = new Connection(RPC_ENDPOINT, "confirmed");
        const latestSlot = await connection.getSlot();
        console.log(`Latest slot: ${latestSlot}`);

        let batchStartSlot = latestSlot;
        let batchCount = 0;

        for (let i = 0; i < numSamples * batchSize; i += batchSize) {
            const solPriceUSD = await getSolanaPriceInUSD();
            if (!solPriceUSD) {
                console.log("Unable to fetch Solana price. Skipping USD conversions.");
                return;
            }

            const priorityFees = []; //delete
            const computeUnits = [];
            let totalNonVotingTransactions = 0;
            //const successFees = [];
            //const failedFees = [];
            //const successComputeUnits = [];
            //const failedCOmputeUnits = [];

            for (let j = 0; j < batchSize; j++) {
                const slot = latestSlot - i - j;
                console.log(`Fetching block at slot: ${slot}`);

                const block = await connection.getBlock(slot, {
                    maxSupportedTransactionVersion: 0,
                    transactionDetails: "full",
                    rewards: false, //Need to fetch rewards data
                });

                if (!block || !block.transactions) {
                    console.log(`No transactions found in block at slot ${slot}.`);
                } else {
                    block.transactions.forEach((tx) => {
                        if (!isVotingTransaction(tx)) {
                        //    totalNonVotingTransactions++;
                            const meta = tx.meta;
                            if (meta && meta.fee !== undefined) {
                                const feeInSOL = meta.fee / LAMPORTS_PER_SOL;
                                //if (meta.err === null){
                                //    successFees.push(feeInSOL);
                                //    totalSuccessTxs++;
                                //    if(meta.computeUnitsConsumed !== undefined){
                                //        successComputeUnits.push(meta.computeUnitsComsumed);
                                //    }
                                //else {
                                //    failedFees.push(feeInSOL);
                                //    totalFailedTxs++;
                                //    if(meta.computeUnitsConsumed !== undefined){
                                //        failedConputeUnits.push(meta.computeUnitsConsumed)}
                                //    }
                                if (feeInSOL > 0) { //Delete
                                    priorityFees.push(feeInSOL); //Delete 
                                    totalNonVotingTransactions++; //Delete
                                } //delete
                            }
                            if (meta && meta.computeUnitsConsumed !== undefined) { // delete
                                computeUnits.push(meta.computeUnitsConsumed); //delete
                            } //delete
                        }
                    });
                    //if (block.rewards >0){
                    //    totalIssuanceRewards += block.rewards.reduce((sum, reward) => sum +(reward.lamports || 0), 0);
                    //}
                }

                // Add a delay between block fetches
                if (delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
                }
            }

            if (priorityFees.length === 0) {
                console.log("No priority fees found in the scanned blocks.");
                continue;
            }

            //const sortedSuccessFees = successFees.sort((a,b) => a - b);
            //We are leaving out FailedFees for now
            //const sortedSuccessCUs = successComputeUnits.sort((a,b) => a-b );
           
            const maxFee = sortedFees[sortedFees.length - 1];
            const averageFee = sortedFees.reduce((sum, fee) => sum + fee, 0) / sortedFees.length;
            const medianFee =
                sortedFees.length % 2 === 0
                    ? (sortedFees[sortedFees.length / 2 - 1] + sortedFees[sortedFees.length / 2]) / 2
                    : sortedFees[Math.floor(sortedFees.length / 2)];

            const sortedComputeUnits = computeUnits.sort((a, b) => a - b);
            const maxCU = sortedComputeUnits[sortedComputeUnits.length - 1];
            const averageCU = computeUnits.reduce((sum, cu) => sum + cu, 0) / computeUnits.length;
            const medianCU =
                computeUnits.length % 2 === 0
                    ? (sortedComputeUnits[computeUnits.length / 2 - 1] + sortedComputeUnits[computeUnits.length / 2]) / 2
                    : sortedComputeUnits[Math.floor(computeUnits.length / 2)];

            const blockTime = 0.4;
            const totalTime = batchSize * blockTime;
            const averageTPS = totalNonVotingTransactions / totalTime;
            // const issuanceRewards = 
            //const ComputeUnitPriceSuccess = sortedSuccessFees.reduce((sum, fee) => sum + fee, 0) / sortedSuccessCUs.length;

            printReport(
                batchStartSlot,
                batchStartSlot - (batchSize - 1),
                totalNonVotingTransactions,
                averageTPS,
                maxFee,
                averageFee,
                medianFee,
                maxCU,
                averageCU,
                medianCU,
                solPriceUSD
            );

            saveData(
                batchStartSlot,
                batchStartSlot - (batchSize - 1),
                totalNonVotingTransactions,
                averageTPS,
                maxFee,
                averageFee,
                medianFee,
                maxCU,
                averageCU,
                medianCU,
                solPriceUSD
            );

            batchStartSlot -= batchSize;
            batchCount++;
        }

        console.log(`Processed ${batchCount} batches of ${batchSize} blocks.`);
    } catch (error) {
        console.error("Error analyzing priority fees:", error);
    }
}

// Run the analysis
analyzePriorityFees(numSamples, batchSize, delay);
