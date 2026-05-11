# IP Tools Telegram Bot 🌐

[中文](README.md) | **English**

A self-hosted Telegram bot for IP lookup images. Send an IPv4 address or domain name, then generate:

- **Official IPPure result PNG**
- **bgp.tools BGP path image**

The bot is whitelist-only by default. You need to provide your own Telegram Bot Token and allowed Telegram user IDs.

## Features

- IPv4 lookup
- Domain lookup with automatic A-record resolution
- IPPure PNG exported through the official screenshot button
- BGP path image from bgp.tools
- Direct private chat usage
- Group usage only when the bot is mentioned, to avoid noise
- Whitelist mode by default

## Commands

- `/start` — quick intro
- `/help` — usage guide

## Installation

Prepare:

- `BOT_TOKEN` from [@BotFather](https://t.me/BotFather)
- Your numeric Telegram user ID, e.g. from [@userinfobot](https://t.me/userinfobot) or [@RawDataBot](https://t.me/RawDataBot)

The bot requires `OWNER_ID` or `ALLOWED_USER_IDS` unless `PUBLIC_ACCESS=true` is explicitly set.

### Docker Compose

Recommended. The default compose file uses the prebuilt GHCR image.

```bash
git clone https://github.com/shuijiao1/IP-Tools-Telegram-Bot.git
cd ip-tools-telegram-bot
cp .env.example .env
nano .env
```

Fill at least:

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
PUBLIC_ACCESS=false
```

Start:

```bash
docker compose up -d
```

Logs:

```bash
docker compose logs -f
```

Stop:

```bash
docker compose down
```

Update:

```bash
git pull
docker compose pull
docker compose up -d
```

### Docker

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot
curl -fsSL https://raw.githubusercontent.com/shuijiao1/IP-Tools-Telegram-Bot/main/.env.example -o .env
nano .env
```

Pull and run:

```bash
docker pull ghcr.io/shuijiao1/IP-Tools-Telegram-Bot:latest

docker run -d \
  --name ip-tools-telegram-bot \
  --restart unless-stopped \
  --env-file .env \
  --shm-size=1g \
  --security-opt seccomp=unconfined \
  -v "$PWD/data:/app/data" \
  -v "$PWD/tmp:/tmp/ip-tools-telegram-bot" \
  ghcr.io/shuijiao1/IP-Tools-Telegram-Bot:latest
```

### Manual install

Requirements:

- Node.js 22+
- Python 3
- Chromium / Playwright runtime dependencies
- Cairo / librsvg / Noto CJK fonts

Debian / Ubuntu dependencies:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip python3-cairo libcairo2 librsvg2-bin fonts-noto-cjk fonts-dejavu-core ca-certificates
```

Run:

```bash
git clone https://github.com/shuijiao1/IP-Tools-Telegram-Bot.git
cd ip-tools-telegram-bot
npm install --omit=dev
npx playwright install chromium --with-deps
cp .env.example .env
nano .env
npm start
```

## Configuration

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
ALLOWED_USER_IDS=
PUBLIC_ACCESS=false
DATA_DIR=/app/data
TMP_DIR=/tmp/ip-tools-telegram-bot
```

- `BOT_TOKEN`: Telegram Bot Token, required
- `OWNER_ID`: primary allowed Telegram user ID
- `ALLOWED_USER_IDS`: comma-separated extra allowed user IDs
- `PUBLIC_ACCESS`: allow everyone when set to `true`; default is `false`
- `DATA_DIR`: BGP image cache directory
- `TMP_DIR`: temporary files directory

## Privacy

- No Bot Token, user ID, chat ID, or personal config is included in this repository
- `.env` is ignored by Git; never commit real secrets
- Whitelist mode is enabled by default
- Lookups call third-party services: IPPure and bgp.tools
- IPPure temporary images are cleaned after sending; BGP images are cached in `DATA_DIR`

## License

MIT
