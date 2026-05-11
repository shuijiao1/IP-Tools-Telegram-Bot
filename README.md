# IP Tools Telegram Bot 🌐

**中文** | [English](README.en.md)

一个默认白名单模式的 Telegram IP 查询图片 Bot。发送 IPv4 或域名后，可以一键生成：

- **IPPure 官方结果图**
- **bgp.tools BGP 路由图**

适合自托管使用。你需要自己填写 Telegram Bot Token 和允许使用 Bot 的 Telegram 用户 ID。

## 功能

- 支持 IPv4 查询
- 支持域名查询，自动解析 A 记录为 IPv4
- IPPure 使用网站官方截图按钮导出的 PNG
- BGP 图来自 bgp.tools path image
- 私聊直接发送 IP / 域名即可使用
- 群聊需要 `@BotName` 后带 IP / 域名，避免打扰
- 默认白名单模式，默认不公开给所有人使用

## 命令

- `/start` — 查看简单说明
- `/help` — 查看用法

## 安装

先准备两样东西：

- 从 [@BotFather](https://t.me/BotFather) 获取 `BOT_TOKEN`
- 获取你的 Telegram 数字用户 ID，推荐用 [@userinfobot](https://t.me/userinfobot) 或 [@RawDataBot](https://t.me/RawDataBot)

项目默认是白名单模式，至少需要填写 `OWNER_ID` 或 `ALLOWED_USER_IDS`，否则 Bot 会拒绝启动。

### 方式一：Docker Compose

推荐这种方式。仓库里的 `docker-compose.yml` 默认使用 GHCR 镜像，不需要本地构建。

```bash
git clone https://github.com/shuijiao1/ip-tools-telegram-bot.git
cd ip-tools-telegram-bot
cp .env.example .env
nano .env
```

编辑 `.env`，至少填写：

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
PUBLIC_ACCESS=false
```

启动：

```bash
docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

以后更新：

```bash
git pull
docker compose pull
docker compose up -d
```

如果想从源码本地构建镜像，可以把 `docker-compose.yml` 里的 `image:` 改成 `build: .`，或者直接使用下面的纯 Docker 本地构建方式。

### 方式二：纯 Docker

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot
curl -fsSL https://raw.githubusercontent.com/shuijiao1/ip-tools-telegram-bot/main/.env.example -o .env
nano .env
```

拉取镜像：

```bash
docker pull ghcr.io/shuijiao1/ip-tools-telegram-bot:latest
```

运行：

```bash
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

查看日志：

```bash
docker logs -f ip-tools-telegram-bot
```

停止并删除容器：

```bash
docker rm -f ip-tools-telegram-bot
```

更新：

```bash
docker pull ghcr.io/shuijiao1/ip-tools-telegram-bot:latest
docker rm -f ip-tools-telegram-bot
# 然后重新执行上面的 docker run 命令
```

### 方式三：手动安装

适合不想用 Docker、愿意自己处理系统依赖的环境。

需要：

- Node.js 22+
- Python 3
- Chromium / Playwright 运行依赖
- Cairo / librsvg / Noto CJK 字体

Debian / Ubuntu 可以先安装依赖：

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip python3-cairo libcairo2 librsvg2-bin fonts-noto-cjk fonts-dejavu-core ca-certificates
```

安装并运行：

```bash
git clone https://github.com/shuijiao1/ip-tools-telegram-bot.git
cd ip-tools-telegram-bot
npm install --omit=dev
npx playwright install chromium --with-deps
cp .env.example .env
nano .env
npm start
```

如果想长期后台运行，建议配合 `systemd`、`pm2` 或其他进程管理工具。

## 配置说明

`.env` 示例：

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
ALLOWED_USER_IDS=
PUBLIC_ACCESS=false
DATA_DIR=/app/data
TMP_DIR=/tmp/ip-tools-telegram-bot
```

字段说明：

- `BOT_TOKEN`：Telegram Bot Token，必填
- `OWNER_ID`：主要允许用户的 Telegram 数字 ID
- `ALLOWED_USER_IDS`：额外允许用户 ID，多个用英文逗号分隔
- `PUBLIC_ACCESS`：设为 `true` 后允许所有人使用；默认 `false`
- `DATA_DIR`：BGP 图片缓存目录
- `TMP_DIR`：临时文件目录

## 使用示例

私聊：

```text
1.1.1.1
example.com
https://example.com/path
```

群聊：

```text
@YourBotName 1.1.1.1
@YourBotName example.com
```

Bot 会返回按钮：

- `IPPure 图`
- `BGP 图`

点击后生成并发送图片。

## 隐私说明

- 仓库不包含任何 Bot Token、用户 ID、聊天 ID 或个人配置
- `.env` 已加入 `.gitignore`，请不要提交真实配置
- 默认白名单模式，未配置允许用户时会拒绝启动
- 查询 IP / 域名会访问第三方服务：IPPure、bgp.tools
- IPPure 临时图片发送后会自动清理；BGP 图片默认缓存到 `DATA_DIR`

## License

MIT
