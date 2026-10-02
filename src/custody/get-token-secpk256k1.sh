#!/bin/bash
[ -f .env ] && set -a && . ./.env && set +a
: "${CUSTODY_OIDC_TOKEN_URL:?set CUSTODY_OIDC_TOKEN_URL in .env}"
printf '%s' "$(uuidgen)" > ./keys/challenge.txt && \
openssl dgst -sha256 -sign ./keys/privateKey-secp256k1.pem ./keys/challenge.txt \
    | base64 | tr -d '\n' > ./keys/signature.b64 && \
curl -sS -X POST "$CUSTODY_OIDC_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=customer_api" \
    --data-urlencode "signature@./keys/signature.b64" \
    --data-urlencode "challenge@./keys/challenge.txt" \
    --data-urlencode "public_key@./keys/publicKey-secp256k1.b64" \
    | tee token.json | jq . | tee /dev/stderr | jq -r .access_token > ./keys/jwt.txt && \
cat ./keys/jwt.txt