import { Client, xrpToDrops } from "xrpl";

const NETWORK = process.env.XRPL_NETWORK ?? "wss://s.altnet.rippletest.net:51233";

async function main(): Promise<void> {
  const client = new Client(NETWORK);
  await client.connect();

  const { wallet: alice } = await client.fundWallet();
  const { wallet: bob } = await client.fundWallet();
  console.log("Alice:", alice.address);
  console.log("Bob:  ", bob.address);

  const prepared = await client.autofill({
    TransactionType: "Payment",
    Account: alice.address,
    Amount: xrpToDrops("10"),
    Destination: bob.address,
  });

  const signed = alice.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);

  const meta = result.result.meta;
  const code = typeof meta === "object" && meta !== null ? meta.TransactionResult : meta;

  console.log("Result:", code);            // tesSUCCESS on success
  console.log("Tx hash:", result.result.hash);
  console.log(`Explorer: https://testnet.xrpl.org/transactions/${result.result.hash}`);

  await client.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});