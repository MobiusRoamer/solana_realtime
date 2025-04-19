
## Solana Congestions Analysis: Fate of the Dropped Transactions

(https://explorer.solana.com/block/330551202)

Solana does not have a public mempool. This means the networking layer can drop a transaction from the quueue without publicly revealing this censorship before the tx reaches the leader. Then users may retry the service by raising the priority fees if they are willing to pay for moving up the queue. We conduct an analysis cmbining queuing theory with chain data analysis. 

---

## Features

- **Priority Fees and CUP**: Tracks Total Fees, and Compute Unit Price for all, and successful transactions, respectively.
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
node solana_realtime.js -n <numBlocks> -d <delay>
```

### Arguments

| Argument       | Description                                                                 | Default Value |
|----------------|-----------------------------------------------------------------------------|---------------|
| `-n, --numBlocks` | Number of block batches to analyze (e.g., `-n 1000`).                       | **Required**  |
| `-d, --delay`      | Delay in seconds between block fetches.                                     | `10`           |
| `-h, --help`       | Show help message and exit.                                                 | N/A           |

### Examples

1. Analyze 10 blocks and save to a CSV file with a 5-second delay:
   ```bash
   node solana-fee-report.js -n 100 -s csv -b 20 -d 5
   ```

2. Analyze 50 batches of 10 blocks and save to a SQLite3 database with the default 2-second delay:
   ```bash
   node solana_fee_report.js -n 50 -s db
   ```

3. Analyze 1000 batches of 5 blocks and save to a CSV file with no delay:
   ```bash
   node solana_fee_report.js -n 1000 -s csv -b 5 -d 0
   ```

---

## Output
Script generates real time charts in client's web browser. Copy (http://localhost:3000/) into browser to view the chart. 

---

## Dependencies

- [`@solana/web3.js`](https://www.npmjs.com/package/@solana/web3.js): Solana JavaScript API.
- [`axios`](https://www.npmjs.com/package/axios): HTTP client for fetching Solana price data.
- [`minimist`](https://www.npmjs.com/package/minimist): Command-line argument parsing.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Support

If you find this project useful, consider giving it a ⭐️ on GitHub!



