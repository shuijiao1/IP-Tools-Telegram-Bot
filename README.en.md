# 🌐 IP Tools Telegram Bot

[![Docker Image](https://img.shields.io/badge/ghcr.io-ip--tools--telegram--bot-blue?logo=docker)](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/pkgs/container/ip-tools-telegram-bot)
[![Build](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/actions/workflows/docker-ghcr.yml/badge.svg)](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/actions/workflows/docker-ghcr.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[中文](README.md) | **English**

**A self-hosted Telegram bot that returns IPPure official result images and bgp.tools BGP path images.**

> Send an IPv4 address or domain in private chat. The bot resolves domains, then sends two previewable images: IPPure first, BGP second. Group chats require `@BotName` by default to avoid noise. Whitelist mode is enabled by default.

---

## Features

- IPv4 and domain queries; domains are resolved to A records automatically.
- IPPure official PNG exported by the website screenshot/camera button.
- bgp.tools path image for ASN and route visibility.
- Telegram-previewable image delivery.
- Whitelist-first access control via `OWNER_ID` / `ALLOWED_USER_IDS`.
- Docker-first deployment with GHCR images; Docker Compose does not require `git clone`.

---

## Quick Start

Prepare two values first:

1. Create a bot with [@BotFather](https://t.me/BotFather) and get `BOT_TOKEN`.
2. Get your numeric Telegram user ID from [@userinfobot](https://t.me/userinfobot) or [@RawDataBot](https://t.me/RawDataBot).

### Option 1: One-click installer (recommended)

```bash
bash <(curl -Ls https://raw.githubusercontent.com/shuijiao1/IP-Tools-Telegram-Bot/main/deploy.sh)
```

The script checks Docker, asks for the install directory / token / owner ID, writes `.env` and `docker-compose.yml`, then runs `docker compose pull && docker compose up -d`.

### Option 2: Docker Compose (manual, no git clone)

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot

curl -Lo docker-compose.yml https://raw.githubusercontent.com/shuijiao1/IP-Tools-Telegram-Bot/main/docker-compose.yml
curl -Lo .env.example https://raw.githubusercontent.com/shuijiao1/IP-Tools-Telegram-Bot/main/.env.example
cp .env.example .env
nano .env
```

Required values:

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
PUBLIC_ACCESS=false
```

Run:

```bash
docker compose pull
docker compose up -d
docker compose logs -f
```

### Option 3: Docker run

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot
curl -Lo .env https://raw.githubusercontent.com/shuijiao1/IP-Tools-Telegram-Bot/main/.env.example
nano .env

docker run -d \
  --name ip-tools-telegram-bot \
  --restart unless-stopped \
  --env-file .env \
  --shm-size=1g \
  --security-opt seccomp=unconfined \
  -v "$PWD/data:/app/data" \
  -v "$PWD/tmp:/tmp/ip-tools-telegram-bot" \
  ghcr.io/shuijiao1/ip-tools-telegram-bot:latest
```

---

## Usage

Private chat:

```text
1.1.1.1
example.com
https://example.com/path
```

Group chat:

```text
@YourBotName 1.1.1.1
@YourBotName example.com
```

The bot sends:

1. IPPure official result image
2. bgp.tools BGP path image

Commands:

- `/start` — short intro
- `/help` — usage help

---

## Configuration

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
ALLOWED_USER_IDS=
PUBLIC_ACCESS=false
DATA_DIR=/app/data
TMP_DIR=/tmp/ip-tools-telegram-bot
```

`OWNER_ID` or `ALLOWED_USER_IDS` is required unless `PUBLIC_ACCESS=true` is explicitly set.

---

## Operations

```bash
cd <install-dir>
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

Upgrade:

```bash
cd <install-dir>
docker compose pull
docker compose up -d
```

---

## Development

```bash
git clone https://github.com/shuijiao1/IP-Tools-Telegram-Bot.git
cd IP-Tools-Telegram-Bot
npm install --omit=dev
npx playwright install chromium --with-deps
cp .env.example .env
nano .env
npm start
```

Check syntax:

```bash
npm run check
```

## License

MIT

---

## ⚙️ Versioning and Releases

- Current version: `v0.1.3`
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Docker images are published as `latest`, `v0.1.3`, and commit sha tags
- GitHub Releases are generated from `CHANGELOG.md`
- Maintainers can publish a new version with:

```bash
./release.sh <version> "release notes"
```
