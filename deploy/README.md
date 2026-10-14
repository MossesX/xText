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

## Current production setup

The VPS at 31.97.13.252 runs Coolify, whose Traefik proxy owns ports 80 and 443. The gallery is
deployed with `docker-compose.traefik.yml`: the container joins the `coolify` network and carries
Traefik labels for `xgallery.amberxai.com`, so Traefik routes the hostname and issues the
certificate. The deploy workflow picks this automatically when it finds the `coolify` network, and
falls back to the standalone Caddy stack otherwise.

## Option A: GitHub Actions (recommended, continuous)

`.github/workflows/deploy.yml` copies the source to the VPS (31.97.13.252), builds the image
there and starts the stack, then checks https://xgallery.amberxai.com/healthz. Add one repository
secret (GitHub -> Settings -> Secrets and variables -> Actions -> New repository secret):

| Secret | Value |
| --- | --- |
| `VPS_PASSWORD` | the VPS root password (hPanel -> VPS -> Settings -> Root password) |

or, instead of a password, `VPS_SSH_KEY` with a private key whose public half is in the VPS
`authorized_keys`. `VPS_USER` is optional and defaults to `root`.

Then push to `main`, or run the workflow from the Actions tab.
The job also publishes `ghcr.io/mossesx/xgallery` for use with hPanel's Docker Manager.

## Option B: hPanel Docker Manager (no command line)

1. hPanel -> **Domains** -> amberxai.com -> **DNS / Nameservers**: add an `A` record, name `xgallery`,
   pointing at the VPS IP, TTL 300.
2. hPanel -> **VPS** -> your server -> **Firewall**: allow TCP 80 and 443 (and UDP 443 for HTTP/3).
3. Make the image public so the VPS can pull it without a login: GitHub -> your profile ->
   **Packages** -> `xgallery` -> **Package settings** -> Danger zone -> **Change visibility** -> Public.
   (The image is built by the workflow on every push; the source repo stays private.)
4. hPanel -> **VPS** -> your server -> **Docker Manager** -> **Create project** -> **Compose file**.
   Name it `xgallery` and paste the contents of `deploy/hpanel-compose.yml`, then deploy.
5. Open https://xgallery.amberxai.com once Docker Manager shows both containers running.

To update later, re-run the push to GitHub, then in Docker Manager choose the project and **Update**
(or restart); `pull_policy: always` fetches the newest image.

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
git clone https://github.com/MossesX/xGallery.git /opt/xgallery && cd /opt/xgallery
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
