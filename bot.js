import { Markup, Telegraf } from 'telegraf';
import { spawn } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import fs from 'node:fs';

const APP_DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA_DIR = process.env.DATA_DIR || path.join(APP_DIR, 'data');
const TMP_ROOT = process.env.TMP_DIR || path.join('/tmp', 'ip-tools-telegram-bot');
const BGP_SCRIPT = path.join(APP_DIR, 'scripts', 'bgp_fetch.py');
const IPPURE_SCRIPT = path.join(APP_DIR, 'scripts', 'download_ippure.js');
const BGP_ROOT = path.join(DATA_DIR, 'bgp');
const TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = String(process.env.OWNER_ID || '').trim();
const ALLOWED_USER_IDS = new Set(
  String(process.env.ALLOWED_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
);
if (OWNER_ID) ALLOWED_USER_IDS.add(OWNER_ID);
const PUBLIC_ACCESS = String(process.env.PUBLIC_ACCESS || '').toLowerCase() === 'true';

if (!TOKEN) throw new Error('BOT_TOKEN is required');
if (!PUBLIC_ACCESS && ALLOWED_USER_IDS.size === 0) {
  throw new Error('Whitelist mode is enabled. Set OWNER_ID or ALLOWED_USER_IDS, or set PUBLIC_ACCESS=true.');
}

const bot = new Telegraf(TOKEN, { handlerTimeout: 10 * 60 * 1000 });

const IPV4_RE = /(?:^|\D)((?:\d{1,3}\.){3}\d{1,3})(?:\D|$)/;
const DOMAIN_RE = /^(?:https?:\/\/)?(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:[\/?#].*)?$/;

function isAllowed(ctx) {
  if (PUBLIC_ACCESS) return true;
  return ALLOWED_USER_IDS.has(String(ctx.from?.id || ''));
}

async function guard(ctx) {
  if (isAllowed(ctx)) return true;
  const id = ctx.from?.id || 'unknown';
  const text = `无权限使用这个 Bot。你的 Telegram ID：${id}`;
  if (ctx.callbackQuery) await ctx.answerCbQuery('无权限', { show_alert: true }).catch(() => {});
  else await ctx.reply(text).catch(() => {});
  return false;
}

function cleanTarget(input) {
  const text = String(input || '').trim();
  if (!text || text.startsWith('/')) return '';
  const first = text.split(/\s+/)[0]?.trim() || '';
  const ip = first.match(IPV4_RE)?.[1];
  if (ip && isIpv4(ip)) return ip;
  if (DOMAIN_RE.test(first)) {
    return first
      .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
      .split('/')[0]
      .split('?')[0]
      .replace(/:\d+$/, '')
      .replace(/\.$/, '');
  }
  return '';
}

function isIpv4(value) {
  const m = String(value || '').match(IPV4_RE);
  if (!m) return false;
  const parts = m[1].split('.').map(Number);
  return parts.length === 4 && parts.every(n => Number.isInteger(n) && n >= 0 && n <= 255);
}

function safeTarget(target) {
  return String(target)
    .replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .replace(/:/g, '_')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'target';
}

async function resolveToIpv4(target) {
  if (isIpv4(target)) return target.match(IPV4_RE)[1];
  const host = cleanTarget(target);
  if (!host) throw new Error('没有识别到 IP 或域名。');
  const res = await lookup(host, { family: 4 });
  if (!res?.address || !isIpv4(res.address)) throw new Error('域名没有解析到 IPv4。');
  return res.address;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: APP_DIR,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs || 120000);
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: String(err?.stack || err) });
    });
  });
}

async function existsNonEmpty(file) {
  try {
    const s = await stat(file);
    return s.isFile() && s.size > 0;
  } catch {
    return false;
  }
}

function parseBgpOutput(stdout, target, outdir) {
  const latest = stdout.match(/^LATEST=(.+)$/m)?.[1]?.trim();
  return latest || path.join(outdir, `latest-${safeTarget(target)}.png`);
}

async function generateBGP(ip) {
  const outdir = path.join(BGP_ROOT, `bgp-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(outdir, { recursive: true });
  const res = await run('python3', [BGP_SCRIPT, '--outdir', outdir, ip], { timeoutMs: 90000 });
  if (res.code !== 0) {
    throw new Error((res.stdout + '\n' + res.stderr).trim().split('\n').slice(-8).join('\n') || `BGP failed: ${res.code}`);
  }
  const png = parseBgpOutput(res.stdout, ip, outdir);
  if (!(await existsNonEmpty(png))) throw new Error('BGP 图片生成后未找到文件');
  return png;
}

async function generateIPPure(ip) {
  if (!isIpv4(ip)) throw new Error('IPPure 只支持 IPv4。');
  const outdir = path.join(TMP_ROOT, `ippure-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(outdir, { recursive: true });
  const res = await run('node', [IPPURE_SCRIPT, '--ip', ip, '--outdir', outdir], { timeoutMs: 90000 });
  if (res.code !== 0) {
    throw new Error((res.stdout + '\n' + res.stderr).trim().split('\n').slice(-8).join('\n') || `IPPure failed: ${res.code}`);
  }
  const png = res.stdout.trim().split('\n').pop()?.trim();
  if (!png || !(await existsNonEmpty(png))) throw new Error('IPPure 图片生成后未找到文件');
  return png;
}

async function sendPng(ctx, filePath) {
  await ctx.replyWithPhoto({ source: fs.createReadStream(filePath) });
}

function mentionedBot(ctx, text) {
  const type = ctx.chat?.type;
  if (type === 'private') return true;
  if (type !== 'group' && type !== 'supergroup') return false;
  const username = ctx.botInfo?.username || bot.botInfo?.username;
  if (!username) return false;
  const mention = `@${username}`.toLowerCase();
  return String(text || '').toLowerCase().includes(mention);
}

function choiceKeyboard(ip) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('IPPure 图', `ippure:${ip}`),
      Markup.button.callback('BGP 图', `bgp:${ip}`),
    ],
  ]);
}

bot.start(async (ctx) => {
  if (!await guard(ctx)) return;
  await ctx.reply('发 IPv4 或域名，我会生成 IPPure 或 BGP 图。群里请 @我 再带上 IP/域名。');
});

bot.help(async (ctx) => {
  if (!await guard(ctx)) return;
  await ctx.reply([
    '用法：',
    '1. 私聊直接发送 IPv4 或域名',
    '2. 群聊 @BotName 1.1.1.1',
    '3. 选择 IPPure 图或 BGP 图',
    '',
    '默认白名单模式；公开使用请设置 PUBLIC_ACCESS=true。',
  ].join('\n'));
});

bot.on('text', async (ctx) => {
  if (!await guard(ctx)) return;
  const text = ctx.message.text || '';
  if (!mentionedBot(ctx, text)) return;
  const username = ctx.botInfo?.username || bot.botInfo?.username || '';
  const cleaned = username ? text.replace(new RegExp(`@${username}\\b`, 'ig'), ' ') : text;
  const target = cleanTarget(cleaned);
  if (!target) return;
  try {
    const ip = await resolveToIpv4(target);
    const suffix = target === ip ? '' : `（${target} → ${ip}）`;
    await ctx.reply(`请选择要生成的图片${suffix}：`, choiceKeyboard(ip));
  } catch (err) {
    await ctx.reply(`失败：${String(err?.message || err).slice(0, 900)}`);
  }
});

async function handleImageChoice(ctx, type, ip) {
  if (!await guard(ctx)) return;
  if (!isIpv4(ip)) {
    await ctx.answerCbQuery('无效 IPv4');
    return;
  }
  await ctx.answerCbQuery('开始生成…');
  let feedback;
  try {
    feedback = await ctx.reply(`正在生成 ${type === 'bgp' ? 'BGP' : 'IPPure'} 图…`);
    const png = type === 'bgp' ? await generateBGP(ip) : await generateIPPure(ip);
    await sendPng(ctx, png);
    await ctx.deleteMessage(feedback.message_id).catch(() => {});
    if (type === 'ippure') await rm(path.dirname(png), { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    const msg = `失败：${String(err?.message || err).slice(0, 900)}`;
    if (feedback?.message_id) {
      await ctx.telegram.editMessageText(ctx.chat.id, feedback.message_id, undefined, msg).catch(() => {});
    } else {
      await ctx.reply(msg);
    }
  }
}

bot.action(/^ippure:((?:\d{1,3}\.){3}\d{1,3})$/, async (ctx) => {
  await handleImageChoice(ctx, 'ippure', ctx.match[1]);
});

bot.action(/^bgp:((?:\d{1,3}\.){3}\d{1,3})$/, async (ctx) => {
  await handleImageChoice(ctx, 'bgp', ctx.match[1]);
});

bot.catch((err) => {
  console.error('[bot error]', err);
});

await mkdir(DATA_DIR, { recursive: true });
await mkdir(TMP_ROOT, { recursive: true });
await bot.launch({ dropPendingUpdates: true });
console.log('ip-tools telegram bot started');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
