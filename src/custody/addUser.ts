import { paginate, RippleCustody, type CustodyDebugEvent } from "@florent-uzio/custody"
import { randomUUID } from "node:crypto"
import { logger } from "../util/logger.js"

// ---------------------------------------------------------------------------
// Edit these before each run. The new user's keypair is generated on the phone
// by the MFA app, which hands back only the base64 public key below — no
// private key material ever reaches this machine.
// ---------------------------------------------------------------------------
const NEW_USER_ALIAS = process.env.NEW_USER_ALIAS ?? ""
const NEW_USER_PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiqB7k8XjI/owY+O6QvkyYvATXbolFvdHtWRR8/7PkNPHjAgPXTpi9OzryMzs0SGn7QhnGUVV1X9av1zh9T+wPw=="
const NEW_USER_ROLES: string[] = ["admin"]
const NEW_USER_DESCRIPTION = ""
// This devbox has login enabled, so `loginIds` is mandatory — omitting it is
// rejected as InvalidIntentError / "Missing login ids". Both the login id and
// the alias are domain-unique. Existing users here use the email as the login
// id and "harmonize" (the internal provider) as the provider id.
const LOGIN_PROVIDER_ID = "harmonize"
// ---------------------------------------------------------------------------

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const CUSTODY_DOMAIN_ID = requireEnv("CUSTODY_DOMAIN_ID")

// The proposing (existing) operator's credentials.
const privateKey = requireEnv("PRIVATE_KEY_SECP256K1")
const publicKey = requireEnv("PUBLIC_KEY_SECP256K1")

// Local guards, so a blank constant fails here
const isBase64 = (value: string) => Buffer.from(value, "base64").toString("base64") === value

if (!NEW_USER_ALIAS.trim()) {
  logger.error("NEW_USER_ALIAS is empty — set it in .env")
  process.exit(1)
}
if (!NEW_USER_PUBLIC_KEY.trim() || !isBase64(NEW_USER_PUBLIC_KEY)) {
  logger.error(
    "NEW_USER_PUBLIC_KEY must be the base64 public key from the MFA app — set it at the top of src/custody/addUser.ts",
  )
  process.exit(1)
}
if (NEW_USER_ROLES.length === 0) {
  logger.error("NEW_USER_ROLES is empty — set at least one role in src/custody/addUser.ts")
  process.exit(1)
}

const custody = new RippleCustody({
  apiUrl: requireEnv("CUSTODY_API_URL"),
  authUrl: requireEnv("CUSTODY_AUTH_URL"),
  privateKey,
  publicKey,
  debug: (event: CustodyDebugEvent) => {
    // A 404 while polling an intent is expected, not a failure: the intent is
    // not queryable for a moment after `propose` returns, and `waitForExecution`
    // swallows 404s and retries within the same loop. Logging those at ERROR
    // makes a healthy run look broken, so they go to debug like any other
    // in-flight detail.
    const isPollMiss = event.kind === "error" && event.status === 404 && event.method === "GET"
    if (event.kind === "error" && !isPollMiss) {
      logger.error({ ...event }, "custody request failed")
    } else {
      logger.debug({ ...event })
    }
  },
})

// Which domain are we acting in? Throws when the login has several domains and
// CUSTODY_DOMAIN_ID does not pin one.
try {
  await custody.domains.me({ domainId: CUSTODY_DOMAIN_ID })
  logger.info({ CUSTODY_DOMAIN_ID }, "proposing in domain")
} catch (error) {
  logger.error(
    { error },
    "could not resolve the domain — set CUSTODY_DOMAIN_ID if this login has more than one",
  )
  process.exit(1)
}

// Reject a typo'd role against the domain's own list, and show what is valid.
try {
  const { roles: knownRoles } = await custody.users.knownRoles({ domainId: CUSTODY_DOMAIN_ID })
  const unknown = NEW_USER_ROLES.filter((role) => !knownRoles.includes(role))
  if (unknown.length > 0) {
    logger.error({ unknown, knownRoles }, "unknown role(s) in NEW_USER_ROLES")
    process.exit(1)
  }
} catch (error) {
  logger.error({ error }, "could not fetch the domain's known roles")
  process.exit(1)
}

// Alias, public key and login id are all domain-unique. The server rejects a
// clash as NonUniqueUsersByAlias / NonUniqueUsersByPublicKey /
// LoginIdAlreadyAssigned, which says nothing about *which* existing user holds
// it — so check here and name the conflict.
try {
  const [byAlias, byPublicKey] = await Promise.all([
    custody.users.list({ domainId: CUSTODY_DOMAIN_ID }, { alias: NEW_USER_ALIAS }),
    custody.users.list({ domainId: CUSTODY_DOMAIN_ID }, { publicKey: NEW_USER_PUBLIC_KEY }),
  ])

  if (byAlias.items.length > 0) {
    logger.error(
      { alias: NEW_USER_ALIAS, existingUserId: byAlias.items[0]?.data.id },
      "a user with this alias already exists in the domain — pick a different NEW_USER_ALIAS",
    )
    process.exit(1)
  }
  if (byPublicKey.items.length > 0) {
    logger.error(
      { existingAlias: byPublicKey.items[0]?.data.alias },
      "this public key is already registered to another user — generate a fresh keypair in the MFA app",
    )
    process.exit(1)
  }

  // No server-side filter for login ids, so walk every page rather than
  // concluding "not taken" from the first one.
  const fetchPage = (startingAfter?: string) =>
    custody.users.list({ domainId: CUSTODY_DOMAIN_ID }, { limit: 100, startingAfter })

  for await (const user of paginate(fetchPage)) {
    const clash = user.data.loginIds?.some(
      (login) => login.id === NEW_USER_ALIAS && login.providerId === LOGIN_PROVIDER_ID,
    )
    if (clash) {
      logger.error(
        { loginId: NEW_USER_ALIAS, providerId: LOGIN_PROVIDER_ID, existingAlias: user.data.alias },
        "this login id is already assigned to another user — pick a different NEW_USER_LOGIN_ID",
      )
      process.exit(1)
    }
  }
} catch (error) {
  logger.error({ error }, "could not check alias/public key/login id uniqueness")
  process.exit(1)
}

// This id becomes the *user's* id. It is not the intent id — the SDK mints that
// one separately and returns it as `intentId`.
const userId = randomUUID()

const result = await custody.intents.proposeAndWait(
  {
    type: "v0_CreateUser",
    id: userId,
    alias: NEW_USER_ALIAS,
    publicKey: NEW_USER_PUBLIC_KEY,
    roles: NEW_USER_ROLES,
    lock: "Unlocked",
    description: NEW_USER_DESCRIPTION,
    customProperties: {},
    loginIds: [{ id: NEW_USER_ALIAS, providerId: LOGIN_PROVIDER_ID }],
  },
  {
    domainId: CUSTODY_DOMAIN_ID,
    description: `Create user ${NEW_USER_ALIAS}`,
    maxRetries: 20,
    intervalMs: 3000,
    onStatusCheck: (status, attempt) => logger.debug({ status, attempt }, "intent status"),
  },
)

const { status, isTerminal, isSuccess, reason, intentId, requestId } = result

if (isSuccess) {
  logger.info(
    {
      userId,
      alias: NEW_USER_ALIAS,
      loginId: NEW_USER_ALIAS,
      roles: NEW_USER_ROLES,
      intentId,
      requestId,
      domainId: CUSTODY_DOMAIN_ID,
    },
    "user created",
  )
  // Prove the user exists rather than inferring it from the intent status.
  const user = await custody.users.get({ domainId: CUSTODY_DOMAIN_ID, userId })
  logger.info({ user }, "user record")
  process.exit(0)
}

if (!isTerminal) {
  // Governance policies gate this intent on a human approver. Still open after
  // the polling budget is a normal outcome, not a failure.
  logger.warn(
    { status, reason, intentId, domainId: CUSTODY_DOMAIN_ID, userId },
    "intent is still awaiting approval — approve it, then poll with intents.getAndWait({ domainId, intentId })",
  )
  process.exit(0)
}

logger.error({ status, reason, intentId, requestId, domainId: CUSTODY_DOMAIN_ID }, "intent did not create the user")
process.exit(1)
