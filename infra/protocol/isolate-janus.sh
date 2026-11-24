#!/bin/sh
set -eu

umask 077
upstream=/etc/janus/supervisord.conf
isolated=$(mktemp)
postgres="command=/usr/local/bin/docker-entrypoint.sh postgres"
if [ "$(grep -Fxc "$postgres" "$upstream")" -ne 1 ] ||
   [ "$(grep -c '^environment=DATASTORE_KEYS=' "$upstream")" -ne 6 ]; then
    echo 'Unexpected Janus supervisor config for the pinned test image.' >&2
    exit 1
fi

datastore_key=$(head -c 16 /dev/urandom | base64 | tr '+/' '_-' | tr -d '=\r\n')
[ "${#datastore_key}" -eq 22 ]
sed -e "s|^environment=DATASTORE_KEYS=.*|environment=DATASTORE_KEYS=$datastore_key|" \
    -e "s|^$postgres$|$postgres -c listen_addresses=127.0.0.1|" \
    "$upstream" > "$isolated"
unset datastore_key
# The 0.7.148 test image starts the key rotator, but its Dockerfile does not copy this config.
cat > /etc/janus/key_rotator.yaml <<'CONFIG'
database:
  url: postgres://postgres@127.0.0.1:5432/postgres
  check_schema_version: false
key_rotator:
  hpke:
    ciphersuites:
      - kem_id: X25519HkdfSha256
        kdf_id: HkdfSha256
        aead_id: Aes128Gcm
CONFIG
exec /usr/bin/supervisord -c "$isolated"
