#!/usr/bin/env bash
set -euo pipefail

APP_NAME="IP Tools Telegram Bot"
APP_SLUG="ip-tools-telegram-bot"
IMAGE="ghcr.io/shuijiao1/ip-tools-telegram-bot:latest"
DEFAULT_DIR="/opt/ip-tools-telegram-bot"
TMP_DIR_DEFAULT="/tmp/ip-tools-telegram-bot"

C_RESET='\033[0m'
C_CYAN='\033[36m'
C_BLUE='\033[34m'
C_GREEN='\033[32m'
C_RED='\033[31m'
C_YELLOW='\033[33m'

info() { echo -e "${C_GREEN}[OK]${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}[WARN]${C_RESET} $*"; }
err() { echo -e "${C_RED}[ERR]${C_RESET} $*" >&2; }

need_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    err "请使用 root 运行：sudo bash deploy.sh"
    exit 1
  fi
}

header() {
  echo -e "${C_CYAN}============================================${C_RESET}"
  echo -e "${C_CYAN} ${APP_NAME}${C_RESET}"
  echo -e "${C_CYAN} 仓库: https://github.com/shuijiao1/IP-Tools-Telegram-Bot${C_RESET}"
  echo -e "${C_CYAN} 作者: shuijiao1${C_RESET}"
  echo -e "${C_CYAN}============================================${C_RESET}"
  if [ -d "${INSTALL_DIR:-$DEFAULT_DIR}" ]; then
    echo -e "安装状态: ${C_GREEN}已安装${C_RESET}"
  else
    echo -e "安装状态: ${C_RED}未安装${C_RESET}"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$APP_SLUG"; then
    echo -e "运行状态: ${C_GREEN}运行中${C_RESET}"
  else
    echo -e "运行状态: ${C_RED}未运行${C_RESET}"
  fi
  echo
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    info "Docker 和 Docker Compose 已安装"
    return
  fi
  warn "未检测到 Docker / Docker Compose，开始安装"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

write_compose() {
  cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
services:
  ip-tools-telegram-bot:
    image: ${IMAGE}
    container_name: ip-tools-telegram-bot
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATA_DIR: /app/data
      TMP_DIR: /tmp/ip-tools-telegram-bot
    volumes:
      - ./data:/app/data
      - ./tmp:/tmp/ip-tools-telegram-bot
    shm_size: "1gb"
    security_opt:
      - seccomp=unconfined
EOF
}

write_env() {
  cat > "$INSTALL_DIR/.env" <<EOF
BOT_TOKEN=${BOT_TOKEN}
OWNER_ID=${OWNER_ID}
ALLOWED_USER_IDS=${ALLOWED_USER_IDS}
PUBLIC_ACCESS=${PUBLIC_ACCESS}
DATA_DIR=/app/data
TMP_DIR=/tmp/ip-tools-telegram-bot
EOF
}

collect_config() {
  read -rp "安装目录 [${DEFAULT_DIR}]: " INSTALL_DIR
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}

  read -rp "Telegram Bot Token: " BOT_TOKEN
  while [ -z "$BOT_TOKEN" ]; do read -rp "Telegram Bot Token 不能为空: " BOT_TOKEN; done

  read -rp "Owner Telegram User ID: " OWNER_ID
  read -rp "额外允许用户 ID（英文逗号分隔，可空）: " ALLOWED_USER_IDS
  read -rp "是否公开给所有人使用？[y/N]: " public_answer
  case "$public_answer" in
    y|Y|yes|YES) PUBLIC_ACCESS=true ;;
    *) PUBLIC_ACCESS=false ;;
  esac

  if [ -z "$OWNER_ID" ] && [ -z "$ALLOWED_USER_IDS" ] && [ "$PUBLIC_ACCESS" != "true" ]; then
    err "白名单模式下必须填写 OWNER_ID 或 ALLOWED_USER_IDS，或选择公开访问"
    exit 1
  fi
}

deploy() {
  mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/tmp"
  write_env
  write_compose
  cd "$INSTALL_DIR"
  docker compose pull
  docker compose up -d
  docker compose ps
  info "部署完成。现在去 Telegram 给 Bot 发送 /start。"
}

upgrade() {
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}
  if [ ! -f "$INSTALL_DIR/docker-compose.yml" ]; then
    err "未找到 $INSTALL_DIR/docker-compose.yml，请先安装"
    exit 1
  fi
  cd "$INSTALL_DIR"
  docker compose pull
  docker compose up -d
  docker compose ps
  info "升级完成"
}

logs() {
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}
  cd "$INSTALL_DIR"
  docker compose logs -f
}

uninstall() {
  INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}
  if [ ! -d "$INSTALL_DIR" ]; then
    warn "未找到安装目录：$INSTALL_DIR"
    return
  fi
  read -rp "确认停止并删除容器？数据目录会保留。 [y/N]: " ans
  case "$ans" in
    y|Y|yes|YES)
      cd "$INSTALL_DIR"
      docker compose down
      info "容器已删除，数据仍保留在 $INSTALL_DIR"
      ;;
    *) warn "已取消" ;;
  esac
}

main_menu() {
  while true; do
    header
    echo -e "${C_BLUE}=== 基础功能 ===${C_RESET}"
    echo "1) 安装 / 重装"
    echo "2) 升级镜像"
    echo
    echo -e "${C_BLUE}=== 服务管理 ===${C_RESET}"
    echo "3) 查看日志"
    echo "4) 重启服务"
    echo
    echo -e "${C_BLUE}=== 系统功能 ===${C_RESET}"
    echo "5) 停止并删除容器（保留数据）"
    echo "0) 退出"
    echo
    read -rp "请选择: " choice
    case "$choice" in
      1) collect_config; install_docker; deploy; exit 0 ;;
      2) install_docker; upgrade; exit 0 ;;
      3) logs ;;
      4) INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}; cd "$INSTALL_DIR" && docker compose restart && docker compose ps ;;
      5) uninstall ;;
      0) exit 0 ;;
      *) warn "无效选择" ;;
    esac
  done
}

need_root
main_menu
