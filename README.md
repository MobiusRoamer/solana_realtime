
## Solana Fee Report Script

A Node.js script to analyze Solana transaction fees and compute units. This script fetches blocks from the Solana blockchain, calculates priority fees, and generates reports in either a SQLite3 database or a CSV file.

---

## Features

- **Fetch Blocks**: Retrieve blocks from the Solana blockchain.
- **Priority Fee Analysis**: Calculate max, average, median, and 95th percentile fees.
- **Compute Unit Analysis**: Calculate max, average, and median compute units.
- **Storage Options**: Save results to a SQLite3 database or a CSV file.
- **Customizable**: Control the number of blocks, batch size, and delay between fetches.

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/solana-fee-report.git
   cd solana-fee-report
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Usage

Run the script with the following command:

```bash
node solana-fee-report.js -n <numSamples> -s <storage> -b <batchSize> -d <delay>
```

### Arguments

| Argument       | Description                                                                 | Default Value |
|----------------|-----------------------------------------------------------------------------|---------------|
| `-n, --numSamples` | Number of block batches to analyze (e.g., `-n 1000`).                       | **Required**  |
| `-s, --storage`    | Storage format: `db` for SQLite3 database or `csv` for CSV file.            | `db`          |
| `-b, --batchSize`  | Number of blocks per batch (1 to 100).                                      | `10`          |
| `-d, --delay`      | Delay in seconds between block fetches.                                     | `2`           |
| `-h, --help`       | Show help message and exit.                                                 | N/A           |

### Examples

1. Analyze 100 batches of 20 blocks and save to a CSV file with a 5-second delay:
   ```bash
   node solana-fee-report.js -n 100 -s csv -b 20 -d 5
   ```

2. Analyze 50 batches of 10 blocks and save to a SQLite3 database with the default 2-second delay:
   ```bash
   node solana-fee-report.js -n 50 -s db
   ```

3. Analyze 1000 batches of 5 blocks and save to a CSV file with no delay:
   ```bash
   node solana-fee-report.js -n 1000 -s csv -b 5 -d 0
   ```

---

## Output

### SQLite3 Database
If the `-s db` option is used, the script will create a SQLite3 database file named `solana_data.db` with the following schema:

```sql
CREATE TABLE block_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_slot INTEGER,
    end_slot INTEGER,
    total_transactions INTEGER,
    average_tps REAL,
    max_fee_sol REAL,
    average_fee_sol REAL,
    median_fee_sol REAL,
    percentile95_fee_sol REAL,
    max_cu INTEGER,
    average_cu REAL,
    median_cu INTEGER,
    sol_price_usd REAL
);
```

### CSV File
If the `-s csv` option is used, the script will create a CSV file named `solana_data.csv` with the following columns:

```
start_slot,end_slot,total_transactions,average_tps,max_fee_sol,average_fee_sol,median_fee_sol,percentile95_fee_sol,max_cu,average_cu,median_cu,sol_price_usd
```

---

## Dependencies

- [`@solana/web3.js`](https://www.npmjs.com/package/@solana/web3.js): Solana JavaScript API.
- [`axios`](https://www.npmjs.com/package/axios): HTTP client for fetching Solana price data.
- [`sqlite3`](https://www.npmjs.com/package/sqlite3): SQLite3 database operations.
- [`minimist`](https://www.npmjs.com/package/minimist): Command-line argument parsing.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

## Support

If you find this project useful, consider giving it a ⭐️ on GitHub!

```


