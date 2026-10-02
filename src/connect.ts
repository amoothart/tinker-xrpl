import { Client } from "xrpl";

const NETWORK = process.env.XRPL_NETWORK ?? "wss://s.altnet.rippletest.net:51233";

async function main(): Promise<void> {
  const client = new Client(NETWORK);
  await client.connect();
  console.log(`Connected to ${NETWORK}`);

  // Asks the Testnet faucet for a funded account
  const { wallet, balance } = await client.fundWallet();

  console.log("Address:  ", wallet.address);
  console.log("Seed:     ", wallet.seed, "  <-- testnet only, never log on mainnet");
  console.log("Balance:  ", balance, "XRP");

  const info = await client.request({
    command: "account_info",
    account: wallet.address,
    ledger_index: "validated",
  });

  console.log("Sequence: ", info.result.account_data.Sequence);
  console.log(`Explorer:  https://testnet.xrpl.org/accounts/${wallet.address}`);

  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});