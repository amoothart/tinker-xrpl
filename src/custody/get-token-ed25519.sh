#!/bin/bash
OPENSSL=/opt/homebrew/opt/openssl@3/bin/openssl
[ -f .env ] && set -a && . ./.env && set +a
: "${CUSTODY_AUTH_URL:?set CUSTODY_AUTH_URL in .env}"

printf '%s' "$(uuidgen)" > ./keys/challenge.txt && \
$OPENSSL pkeyutl -sign -inkey ./keys/privateKey-ed25519.pem -rawin -in ./keys/challenge.txt \
    | base64 | tr -d '\n' > ./keys/signature.b64 && \
curl -sS -X POST "$CUSTODY_AUTH_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=customer_api" \
    --data-urlencode "signature@./keys/signature.b64" \
    --data-urlencode "challenge@./keys/challenge.txt" \
    --data-urlencode "public_key@./keys/publicKey-ed25519.b64" \
    | tee token.json | jq . | tee /dev/stderr | jq -r .access_token > ./keys/jwt.txt && \
cat ./keys/jwt.txt
