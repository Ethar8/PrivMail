#!/usr/bin/env bash
# Echter SRP-Login gegen den laufenden Stack (ohne ts-node/Frontend-TS-Compile).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
set -a; source .env; set +a

DOMAIN="${DOMAIN:-privmail.test}"
ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-admin@${DOMAIN}}"
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-E2eAdminPassw0rd!}"
R=(-k --resolve "${DOMAIN}:443:127.0.0.1")
JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT

xsrf(){ grep XSRF-TOKEN "$JAR" 2>/dev/null | awk '{print $NF}' | tail -1 || true; }

# Health gate
for i in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sS "${R[@]}" -o /tmp/srp-health.json -w '%{http_code}' "https://${DOMAIN}/api/auth/setup-required" || echo 000)
  [[ "$code" == "200" ]] && break
  sleep 1
done
[[ "$code" == "200" ]] || { echo "API nicht erreichbar HTTP $code"; exit 1; }

curl -sS "${R[@]}" -c "$JAR" -b "$JAR" "https://${DOMAIN}/api/auth/setup-required" >/dev/null
XS="$(xsrf)"
curl -sS "${R[@]}" -c "$JAR" -b "$JAR" -o /tmp/srp-login.json -w 'login %{http_code}\n' \
  -X POST "https://${DOMAIN}/api/auth/login" \
  -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $XS" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}"
XS="$(xsrf)"
curl -sS "${R[@]}" -c "$JAR" -b "$JAR" -o /tmp/srp-enroll.json -w 'enroll %{http_code}\n' \
  -X POST "https://${DOMAIN}/api/auth/srp/enroll" \
  -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $XS" \
  -d "{\"password\":\"${ADMIN_PASSWORD}\"}"

: >"$JAR"
curl -sS "${R[@]}" -c "$JAR" -b "$JAR" "https://${DOMAIN}/api/auth/setup-required" >/dev/null
XS="$(xsrf)"
curl -sS "${R[@]}" -c "$JAR" -b "$JAR" -o /tmp/srp-ch.json -w 'challenge %{http_code}\n' \
  -X POST "https://${DOMAIN}/api/auth/srp/challenge" \
  -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $XS" \
  -d "{\"email\":\"${ADMIN_EMAIL}\"}"
XS="$(xsrf)"

ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" node <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const ch = JSON.parse(fs.readFileSync('/tmp/srp-ch.json', 'utf8'));
if (!ch.challengeId) {
  console.error('no challenge', ch);
  process.exit(1);
}

const N_BYTES = `
AC6BDB41 324A9A9B F166DE5E 1389582F AF72B665 1987EE07 FC319294
3DB56050 A37329CB B4A099ED 8193E075 7767A13D D52312AB 4B03310D
CD7F48A9 DA04FD50 E8083969 EDB767B0 CF609517 9A163AB3 661A05FB
D5FAAAE8 2918A996 2F0B93B8 55F97993 EC975EEA A80D740A DBF4FF74
7359D041 D5C33EA7 1D281E44 6B14773B CA97B43A 23FB8016 76BD207A
436C6481 F1D2B907 8717461A 5B9D32E6 88F87748 544523B5 24B0D57D
5EA77A27 75D2ECFA 032CFBDB F52FB378 61602790 04E57AE6 AF874E73
03CE5329 9CCC041C 7BC308D8 2A5698F3 A8D0C382 71AE35F8 E9DBFBB6
94B5C803 D89F7AE4 35DE236D 525F5475 9B65E372 FCD68EF2 0FA7111F
9E4AFF73`.replace(/\s+/g, '');
const N = BigInt('0x' + N_BYTES);
const g = 2n;
const N_PAD = 256;
const sha256 = (...bufs) => {
  const h = crypto.createHash('sha256');
  for (const b of bufs) h.update(b);
  return h.digest();
};
const toBuf = (n, pad) => {
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const buf = Buffer.from(hex, 'hex');
  if (pad && buf.length < pad) {
    const p = Buffer.alloc(pad);
    buf.copy(p, pad - buf.length);
    return p;
  }
  return buf;
};
const toBI = (b) => BigInt('0x' + b.toString('hex'));
const modPow = (base, exp, mod) => {
  let r = 1n, b = base % mod, e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return r;
};
const xor = (a, b) => {
  const out = Buffer.alloc(Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = a[i] ^ b[i];
  return out;
};

const identity = process.env.ADMIN_EMAIL.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const salt = Buffer.from(ch.salt, 'hex');
const B = BigInt(ch.serverPublicKey);
const a = toBI(crypto.randomBytes(32)) % N;
const A = modPow(g, a, N);
const k = toBI(sha256(toBuf(N, N_PAD), toBuf(g)));
const u = toBI(sha256(toBuf(A, N_PAD), toBuf(B, N_PAD)));
const x = toBI(sha256(salt, sha256(Buffer.from(identity + ':' + password, 'utf8'))));
const gx = modPow(g, x, N);
const base = (B - ((k * gx) % N) + N) % N;
const S = modPow(base, a + u * x, N);
const Skey = sha256(toBuf(S, N_PAD));
const M = sha256(
  xor(sha256(toBuf(N, N_PAD)), sha256(toBuf(g))),
  sha256(Buffer.from(identity, 'utf8')),
  salt,
  toBuf(A, N_PAD),
  toBuf(B, N_PAD),
  Skey,
);
const payload = {
  email: process.env.ADMIN_EMAIL,
  clientPublicKey: A.toString(),
  clientProof: M.toString('hex'),
  challengeId: ch.challengeId,
};
fs.writeFileSync('/tmp/srp-verify-req.json', JSON.stringify(payload));
fs.writeFileSync('/tmp/srp-M.hex', M.toString('hex'));
fs.writeFileSync('/tmp/srp-Skey.hex', Skey.toString('hex'));
fs.writeFileSync('/tmp/srp-A.hex', toBuf(A, N_PAD).toString('hex'));
console.log('clientProof ready');
NODE

curl -sS "${R[@]}" -c "$JAR" -b "$JAR" -o /tmp/srp-ver.json -w 'verify %{http_code}\n' \
  -X POST "https://${DOMAIN}/api/auth/srp/verify" \
  -H 'Content-Type: application/json' -H "X-XSRF-TOKEN: $XS" \
  -d @"/tmp/srp-verify-req.json"

node <<'NODE'
const fs = require('fs');
const crypto = require('crypto');
const ver = JSON.parse(fs.readFileSync('/tmp/srp-ver.json', 'utf8'));
const M = Buffer.from(fs.readFileSync('/tmp/srp-M.hex', 'utf8'), 'hex');
const Skey = Buffer.from(fs.readFileSync('/tmp/srp-Skey.hex', 'utf8'), 'hex');
const A = Buffer.from(fs.readFileSync('/tmp/srp-A.hex', 'utf8'), 'hex');
const expected = crypto.createHash('sha256').update(A).update(M).update(Skey).digest('hex');
const proofOk = ver.serverProof === expected;
const ok = ver.user && ver.user.email && proofOk;
console.log(JSON.stringify({ ok, email: ver.user && ver.user.email, proofOk, hasServerProof: !!ver.serverProof }));
if (!ok) {
  console.error(ver);
  process.exit(1);
}
NODE

echo "✅ SRP E2E Login OK"
