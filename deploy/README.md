# Deploying to xgallery.amberxai.com (Hostinger VPS, Docker)

The app is a static single-page build served by nginx inside a container, with Caddy in
front for automatic HTTPS. Everything lives in `docker-compose.yml`.

## What you need once

1. **A Hostinger VPS** with Docker (pick the "Docker" OS template when creating it, or run
   `curl -fsSL https://get.docker.com | sh` on an Ubuntu VPS).
2. **DNS**: an `A` record `xgallery.amberxai.com -> <VPS IP>`. If amberxai.com's DNS is at
   Hostinger, `deploy/hostinger-setup.sh` creates it through the API; otherwise add it at your
   DNS provider.
3. **Ports 80 and 443 open** on the VPS firewall (hPanel -> VPS -> Firewall).

## Option A: GitHub Actions (recommended, continuous)

`.github/workflows/deploy.yml` builds the image, pushes it to `ghcr.io/mossesx/xtext`, then
SSHes into the VPS and runs `docker compose pull && up -d`. Add these repository secrets
(GitHub -> Settings -> Secrets and variables -> Actions):

| Secret | Value |
| --- | --- |
| `VPS_HOST` | VPS public IP |
| `VPS_USER` | `root` (or your SSH user) |
| `VPS_SSH_KEY` | private key; put its public half in the VPS `~/.ssh/authorized_keys` |
| `GHCR_PULL_TOKEN` | GitHub personal access token with `read:packages`, since the repo (and so the image) is private |

Then push to `main` or run the workflow manually. First deploy creates `/opt/xgallery` on the VPS.

## Option B: hPanel Docker Manager (no command line)

1. hPanel -> **Domains** -> amberxai.com -> **DNS / Nameservers**: add an `A` record, name `xgallery`,
   pointing at the VPS IP, TTL 300.
2. hPanel -> **VPS** -> your server -> **Firewall**: allow TCP 80 and 443 (and UDP 443 for HTTP/3).
3. hPanel -> **VPS** -> your server -> **Docker Manager** -> **Create project** -> **Compose file**.
   Name it `xgallery` and paste the contents of `deploy/hpanel-compose.yml`, then deploy.
   The repository must be public for this (GitHub -> Settings -> Danger zone -> Change visibility),
   because the VPS clones it to build the image.
4. Wait for the build to finish in Docker Manager, then open https://xgallery.amberxai.com.

If you prefer to keep the repository private, use **VPS -> Overview -> Browser terminal** and run
the Option D commands below, cloning with a GitHub personal access token.

## Option C: Hostinger API script (one-shot)

```bash
HOSTINGER_API_TOKEN=... ./deploy/hostinger-setup.sh          # single VPS on the account
HOSTINGER_API_TOKEN=... ./deploy/hostinger-setup.sh 123456   # pick a VPS id
```

It upserts the DNS record and creates a Docker Manager project from the compose file. Because
the image is private on GHCR, the VPS must be logged in first: `ssh root@<ip> docker login ghcr.io`.

## Option D: manual, on the VPS (works with a private repo)

```bash
ssh root@<vps-ip>
git clone https://github.com/MossesX/xText.git /opt/xgallery && cd /opt/xgallery
SITE_DOMAIN=xgallery.amberxai.com docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

This builds the image on the VPS itself, so no registry access is needed.

## Verifying

```bash
docker compose ps
docker compose logs -f caddy      # certificate issuance
curl -I https://xgallery.amberxai.com
```

The first visit shows the seeded login (`admin` / `admin123`); change it under Account.
Note that uploads and accounts live in each visitor's browser (IndexedDB), as described in the
main README. Sharing one gallery between people needs a backend behind the same data layer.
