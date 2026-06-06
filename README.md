# 🌐 IP Tools Telegram Bot

[![Docker Image](https://img.shields.io/badge/ghcr.io-ip--tools--telegram--bot-blue?logo=docker)](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/pkgs/container/ip-tools-telegram-bot)
[![Build](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/actions/workflows/docker-ghcr.yml/badge.svg)](https://github.com/shuijiao1/IP-Tools-Telegram-Bot/actions/workflows/docker-ghcr.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**中文** | [English](README.en.md)

**Telegram IP 查询机器人：IPPure 官方结果图 + bgp.tools BGP 路由图 + IP 文本信息查询**

> 私聊发送 IPv4 / 域名，Bot 自动解析并返回两张图：第一张 IPPure，第二张 BGP。  
> 群聊默认需要 `@BotName` 触发，避免刷屏。默认白名单模式，适合自托管。

---

## 🎯 核心特性

- **IPv4 / 域名查询**：域名自动解析 A 记录为 IPv4。
- **IP 文本信息**：新增 `/ip` 命令，可查询地理位置、ISP、组织、AS、时区、代理/数据中心标记。
- **IPPure 官方图片**：使用 ippure.com 页面自带截图 / 相机按钮导出的官方 PNG，不手工重绘。
- **BGP 路由图**：获取 bgp.tools path image，方便查看 ASN / 路由可见性。
- **Telegram 原生发图**：结果以 Telegram 可预览图片发送，不当文件附件。
- **白名单优先**：默认不公开；必须配置 `OWNER_ID` / `ALLOWED_USER_IDS`，或显式开启 `PUBLIC_ACCESS=true`。
- **适合 Docker 部署**：镜像已发布到 GHCR，Docker Compose 不需要 `git clone`。

---

## 🚀 快速开始

先准备：

1. 到 [@BotFather](https://t.me/BotFather) 创建 Bot，拿到 `BOT_TOKEN`。
2. 用 [@userinfobot](https://t.me/userinfobot) 或 [@RawDataBot](https://t.me/RawDataBot) 获取你的 Telegram 数字用户 ID。

提供 3 种部署方式，**推荐一键脚本**。

### 方式一：一键脚本（推荐）

```bash
bash <(curl -Ls https://github.com/shuijiao1/IP-Tools-Telegram-Bot/releases/latest/download/deploy.sh)
```

### 方式二：Docker Compose（手动，无需 git clone）

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot

curl -Lo docker-compose.yml https://github.com/shuijiao1/IP-Tools-Telegram-Bot/releases/latest/download/docker-compose.yml
curl -Lo .env.example https://github.com/shuijiao1/IP-Tools-Telegram-Bot/releases/latest/download/default.env.example
cp .env.example .env
nano .env
```

`.env` 至少填写：

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
PUBLIC_ACCESS=false
```

启动：

```bash
docker compose pull
docker compose up -d
docker compose logs -f
```

### 方式三：Docker 直跑（不用 Compose）

```bash
mkdir -p ip-tools-telegram-bot/data ip-tools-telegram-bot/tmp
cd ip-tools-telegram-bot
curl -Lo .env https://github.com/shuijiao1/IP-Tools-Telegram-Bot/releases/latest/download/default.env.example
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

## 💬 使用方式

### 私聊

直接发送：

```text
1.1.1.1
example.com
https://example.com/path
```

### 群聊

群聊中需要带 Bot 用户名：

```text
@YourBotName 1.1.1.1
@YourBotName example.com
```

Bot 会提供按钮，可选择：

1. IPPure 官方结果图
2. bgp.tools BGP 路由图
3. IP 文本信息

### 命令

- `/start` — 查看简单说明
- `/help` — 查看用法
- `/ip <IP或域名>` — 查询文本 IP 信息；也可回复包含 IP/域名的消息后发送 `/ip`

---

## ⚙️ 配置说明

`.env` 示例：

```env
BOT_TOKEN=123456:your_bot_token_here
OWNER_ID=123456789
ALLOWED_USER_IDS=
PUBLIC_ACCESS=false
DATA_DIR=/app/data
TMP_DIR=/tmp/ip-tools-telegram-bot
```

| 变量 | 是否必填 | 默认值 | 说明 |
|---|---:|---|---|
| `BOT_TOKEN` | 是 | - | Telegram Bot Token |
| `OWNER_ID` | 是* | - | 主要允许用户的 Telegram 数字 ID |
| `ALLOWED_USER_IDS` | 否 | - | 额外允许用户 ID，多个用英文逗号分隔 |
| `PUBLIC_ACCESS` | 否 | `false` | 设为 `true` 后允许所有人使用 |
| `DATA_DIR` | 否 | `/app/data` | BGP 图片缓存目录 |
| `TMP_DIR` | 否 | `/tmp/ip-tools-telegram-bot` | 临时文件目录 |

> `OWNER_ID` / `ALLOWED_USER_IDS` 至少填一个；除非你明确设置 `PUBLIC_ACCESS=true`。

---

## 🛠 运维

所有持久化数据在安装目录下：

```text
ip-tools-telegram-bot/
├── docker-compose.yml
├── .env
├── data/        # BGP 缓存等持久化数据
└── tmp/         # 临时文件
```

常用命令：

```bash
cd <安装目录>
docker compose ps                 # 状态
docker compose logs -f            # 实时日志
docker compose restart            # 重启
docker compose down               # 停止并删除容器，保留 data/tmp
```

升级：

```bash
cd <安装目录>
docker compose pull
docker compose up -d
```

也可以重跑一键脚本并选择升级 / 重装同目录配置。

---

---

## 🧩 源码运行（开发用）

```bash
git clone https://github.com/shuijiao1/IP-Tools-Telegram-Bot.git
cd IP-Tools-Telegram-Bot
npm install --omit=dev
npx playwright install chromium --with-deps
cp .env.example .env
nano .env
npm start
```

语法检查：

```bash
npm run check
```

---

## 🔐 隐私说明

- 仓库不包含任何 Bot Token、用户 ID、聊天 ID 或个人配置。
- `.env` 已加入 `.gitignore`，不要提交真实配置。
- 默认白名单模式，未配置允许用户时会拒绝启动。
- 查询 IP / 域名会访问第三方服务：IPPure、bgp.tools。
- IPPure 临时图片发送后会自动清理；BGP 图片默认缓存到 `DATA_DIR`。

## License

MIT
