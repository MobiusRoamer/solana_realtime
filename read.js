const sqlite3 = require("sqlite3").verbose(); // For SQLite3 database operations

// Create a connection to the SQLite3 database
const db = new sqlite3.Database("solana_data.db");

// Function to process and display data for each set of 10 blocks
function processBlockData() {
    db.all(
        `SELECT * FROM block_data ORDER BY start_slot DESC`,
        (err, rows) => {
            if (err) {
                console.error("Error fetching data from database:", err);
                return;
            }

            if (rows.length === 0) {
                console.log("No data found in the database.");
                return;
            }

            // Display data for each set of 10 blocks
            rows.forEach((row) => {
                console.log(`--- Block Data for Slots ${row.start_slot} to ${row.end_slot} ---`);
                console.log(`Total Non-Voting Transactions: ${row.total_transactions}`);
                console.log(`Average TPS (Non-Voting): ${row.average_tps.toFixed(2)}`);
                console.log(`Max Priority Fee: ${row.max_fee_sol.toFixed(9)} SOL ($${(row.max_fee_sol * row.sol_price_usd).toFixed(2)} USD)`);
                console.log(`Average Priority Fee: ${row.average_fee_sol.toFixed(9)} SOL ($${(row.average_fee_sol * row.sol_price_usd).toFixed(2)} USD)`);
                console.log(`Median Priority Fee: ${row.median_fee_sol.toFixed(9)} SOL ($${(row.median_fee_sol * row.sol_price_usd).toFixed(2)} USD)`);
                console.log(`95th Percentile Priority Fee: ${row.percentile95_fee_sol.toFixed(9)} SOL ($${(row.percentile95_fee_sol * row.sol_price_usd).toFixed(2)} USD)`);
                console.log(`Max Compute Units: ${row.max_cu}`);
                console.log(`Average Compute Units: ${row.average_cu.toFixed(2)}`);
                console.log(`Median Compute Units: ${row.median_cu}`);
                console.log(`Solana Price (USD): $${row.sol_price_usd.toFixed(2)}`);
                console.log("\n"); // Add a blank line for readability
            });
        }
    );
}

// Run the processing function
processBlockData();

// Close the database connection when done
db.close();
