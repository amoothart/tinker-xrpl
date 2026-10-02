import { KeypairService } from "@florent-uzio/custody"

const printKeypair = (algorithm: string, keypair: { privateKey: string; publicKey: string }) => {
  console.log(`\n=== ${algorithm} ===`)
  console.log(`  Private Key: ${keypair.privateKey}`)
  console.log(`  Public Key:  ${keypair.publicKey}`)
}

// Generate Ed25519 keypair
const ed25519Service = new KeypairService("ed25519")
printKeypair("Ed25519", ed25519Service.generate())

// Generate secp256k1 keypair
const secp256k1Service = new KeypairService("secp256k1")
printKeypair("secp256k1", secp256k1Service.generate())

// Generate secp256r1 keypair
const secp256r1Service = new KeypairService("secp256r1")
printKeypair("secp256r1", secp256r1Service.generate())

console.log()
