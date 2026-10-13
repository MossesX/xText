#!/usr/bin/env bash
# One-time Hostinger setup for xgallery.amberxai.com using the Hostinger API.
#
#   HOSTINGER_API_TOKEN=... ./deploy/hostinger-setup.sh [virtual-machine-id]
#
# What it does:
#   1. Lists your VPSes and picks the given id (or the only one).
#   2. Upserts the DNS A record  xgallery.amberxai.com -> VPS IP  (requires amberxai.com DNS at Hostinger).
#   3. Deploys this repo's docker-compose.yml as a Docker Manager project on that VPS.
#
# Requires: curl, jq. Token: hPanel -> Account -> API -> create token (VPS + DNS scopes).
set -euo pipefail

API="https://developers.hostinger.com/api"
DOMAIN="amberxai.com"
SUBDOMAIN="xgallery"
PROJECT="xgallery"
: "${HOSTINGER_API_TOKEN:?Set HOSTINGER_API_TOKEN (hPanel -> Account -> API)}"

hapi() {
  curl -fsS -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H "Content-Type: application/json" "$@"
}

echo "==> Looking up VPS"
VMS=$(hapi "$API/vps/v1/virtual-machines")
if [[ -n "${1:-}" ]]; then
  VM=$(echo "$VMS" | jq -c --argjson id "$1" '.[] | select(.id == $id)')
else
  COUNT=$(echo "$VMS" | jq 'length')
  if [[ "$COUNT" != "1" ]]; then
    echo "Found $COUNT VPSes; pass the id of the one to use:" >&2
    echo "$VMS" | jq -r '.[] | "  \(.id)\t\(.hostname)\t\(.ipv4[0].address // "-")\t\(.state)"' >&2
    exit 1
  fi
  VM=$(echo "$VMS" | jq -c '.[0]')
fi
VM_ID=$(echo "$VM" | jq -r '.id')
VM_IP=$(echo "$VM" | jq -r '.ipv4[0].address')
echo "    VPS $VM_ID ($(echo "$VM" | jq -r '.hostname')) at $VM_IP"

echo "==> Upserting DNS A record $SUBDOMAIN.$DOMAIN -> $VM_IP"
hapi -X PUT "$API/dns/v1/zones/$DOMAIN" -d "$(jq -nc --arg name "$SUBDOMAIN" --arg ip "$VM_IP" '{
  overwrite: true,
  zone: [{ name: $name, type: "A", ttl: 300, records: [{ content: $ip }] }]
}')" >/dev/null && echo "    done"

echo "==> Deploying Docker Manager project '$PROJECT' on VPS $VM_ID"
# Docker Manager receives the compose file content. The Caddyfile is inlined
# through a config entry so no files need to exist on the VPS beforehand.
COMPOSE=$(SITE_DOMAIN="$SUBDOMAIN.$DOMAIN" python3 - <<'PY'
import os, re
compose = open('docker-compose.yml').read()
caddy = open('deploy/Caddyfile').read()
# Resolve the Caddy placeholder to the real domain and escape '$' so compose does not interpolate it.
caddy = caddy.replace('{$SITE_DOMAIN:xgallery.amberxai.com}', os.environ['SITE_DOMAIN']).replace('$', '$$')
# replace the bind-mounted Caddyfile with a compose "configs" entry
compose = compose.replace('      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro\n', '')
compose = compose.replace('    volumes:\n      - caddy_data:/data', '    configs:\n      - source: caddyfile\n        target: /etc/caddy/Caddyfile\n    volumes:\n      - caddy_data:/data')
compose += '\nconfigs:\n  caddyfile:\n    content: |\n' + ''.join('      ' + l for l in caddy.splitlines(True))
print(compose)
PY
)
EXISTING=$(hapi "$API/vps/v1/virtual-machines/$VM_ID/docker" | jq -r --arg p "$PROJECT" '.[] | select(.project == $p or .name == $p) | .project // .name' || true)
BODY=$(jq -nc --arg name "$PROJECT" --arg content "$COMPOSE" '{ project_name: $name, content: $content }')
if [[ -n "$EXISTING" ]]; then
  hapi -X PUT "$API/vps/v1/virtual-machines/$VM_ID/docker/$PROJECT" -d "$BODY" >/dev/null
else
  hapi -X POST "$API/vps/v1/virtual-machines/$VM_ID/docker" -d "$BODY" >/dev/null
fi
echo "    deployed. Note: the app image is private on GHCR; the VPS must be logged in to ghcr.io"
echo "    (ssh root@$VM_IP 'docker login ghcr.io') or use the GitHub Actions workflow which handles this."
echo
echo "==> https://$SUBDOMAIN.$DOMAIN should come up once DNS propagates and Caddy obtains a certificate."
