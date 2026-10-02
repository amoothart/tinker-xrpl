import { prepareSigningInput, RippleCustody, type CustodyDebugEvent } from "@florent-uzio/custody"
import crypto from "node:crypto"
import { logger } from "../util/logger.js"

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const privateKey = requireEnv("PRIVATE_KEY_SECP256K1")
const publicKey = requireEnv("PUBLIC_KEY_SECP256K1")

const custody = new RippleCustody({
  apiUrl: requireEnv("CUSTODY_API_URL"),
  authUrl: requireEnv("CUSTODY_AUTH_URL"),
  privateKey,
  publicKey,
  debug: (event: CustodyDebugEvent) => {
    // event.client is "api" | "auth"; event.kind is "request" | "response" | "error"
    if (event.kind === "error") logger.error({ ...event }, "custody request failed")
    else logger.debug({ ...event })
  },
})

// Simplest possible connectivity check: GET /v1/health. Returns 200 when the
// backend is up; anything else (503, DNS, timeout) rejects with a CustodyError.
try {
  const health = await custody.health.liveness()
  logger.info({ health }, "custody API is alive")
} catch (error) {
  logger.error({ error }, "custody API liveness check failed")
  process.exit(1)
}

// Authenticated round-trip: signs the request with PRIVATE_KEY_ED25519 and
// exchanges it for a token at authUrl, so a success proves the credentials work.
try {
  const me = await custody.users.me()
  logger.info({ me }, "authenticated as")
} catch (error) {
  logger.error({ error }, "custody authenticated call failed")
  process.exit(1)
}

// const domains = await custody.domains.list()
// logger.info({ domains }, "domains response")
