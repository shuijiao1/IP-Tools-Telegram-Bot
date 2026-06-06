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

function htmlEscape(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function extractTargetFromText(text) {
  const input = String(text || '').trim();
  if (!input) return '';
  const ip = input.match(IPV4_RE)?.[1];
  if (ip && isIpv4(ip)) return ip;
  const domain = input.match(/\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}\b/)?.[0];
  if (domain) return cleanTarget(domain);
  return cleanTarget(input);
}

function getCommandArg(ctx) {
  const text = ctx.message?.text || '';
  return text.replace(/^\/[^\s@]+(?:@\S+)?\s*/i, '').trim();
}

function getReplyText(ctx) {
  return ctx.message?.reply_to_message?.text
    || ctx.message?.reply_to_message?.caption
    || '';
}

async function getIpInfo(query) {
  const target = String(query || '').trim();
  if (!target) throw new Error('请提供有效的 IP 地址或域名。');
  const apiUrl = `http://ip-api.com/json/${encodeURIComponent(target)}?lang=zh-CN&fields=status,message,country,regionName,city,isp,org,as,query,timezone,proxy,hosting`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'IP-Tools-Telegram-Bot/0.1' },
    });
    if (!response.ok) throw new Error(`API 请求失败，HTTP ${response.status}`);
    const data = await response.json();
    if (data.status === 'fail') throw new Error(data.message || '查询失败，请检查 IP 地址或域名是否正确。');
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('请求超时，请稍后重试。');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function formatIpInfo(data, originalTarget = '') {
  const country = data.country || 'N/A';
  const region = data.regionName || 'N/A';
  const city = data.city || 'N/A';
  const isp = data.isp || 'N/A';
  const org = data.org || 'N/A';
  const asInfo = data.as || 'N/A';
  const ipAddress = data.query || originalTarget || 'N/A';
  const lines = [];
  if (data.proxy) lines.push('⚠️ 此 IP 可能为代理 IP');
  if (data.hosting) lines.push('⚠️ 此 IP 可能为数据中心 IP');
  if (lines.length) lines.push('');
  lines.push('🌍 <b>IP/域名查询结果</b>');
  lines.push('');
  if (originalTarget && originalTarget !== ipAddress) lines.push(`<b>🔎 查询输入:</b> <code>${htmlEscape(originalTarget)}</code>`);
  lines.push(`<b>🔍 查询目标:</b> <code>${htmlEscape(ipAddress)}</code>`);
  lines.push(`<b>📍 地理位置:</b> ${htmlEscape(country)} - ${htmlEscape(region)} - ${htmlEscape(city)}`);
  lines.push(`<b>🏢 ISP:</b> ${htmlEscape(isp)}`);
  lines.push(`<b>🏦 组织:</b> ${htmlEscape(org)}`);
  lines.push(`<b>🔢 AS号:</b> <code>${htmlEscape(asInfo)}</code>`);
  if (data.timezone) lines.push(`<b>⏰ 时区:</b> ${htmlEscape(data.timezone)}`);
  const asMatch = String(asInfo).match(/^AS(\d+)/);
  if (asMatch) lines.push('', `https://bgp.he.net/AS${asMatch[1]}`);
  return lines.join('\n');
}

async function replyIpInfo(ctx, query) {
  const target = extractTargetFromText(query);
  if (!target) {
    await ctx.reply([
      '📍 IP 信息查询用法：',
      '/ip 8.8.8.8',
      '/ip example.com',
      '也可以回复包含 IP/域名的消息后发送 /ip',
    ].join('\n'));
    return;
  }
  const status = await ctx.reply(`🔍 正在查询：${target}`);
  try {
    const data = await getIpInfo(target);
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, formatIpInfo(data, target), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
    });
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, `❌ 查询失败：${String(err?.message || err).slice(0, 900)}`).catch(async () => {
      await ctx.reply(`❌ 查询失败：${String(err?.message || err).slice(0, 900)}`);
    });
  }
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

function isBgpTemporaryNoPath(output) {
  return /^(PLACEHOLDER|NONE)$/m.test(String(output || ''))
    || /temporarily returned no path image|prefix not visible in DFZ|no usable BGP path image found|no path data/i.test(String(output || ''));
}

function bgpRetryMessage() {
  return 'BGP 图暂时没取到，应该是 bgp.tools 偶发抽风，请再试一次。';
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
    const output = `${res.stdout}\n${res.stderr}`;
    if (isBgpTemporaryNoPath(output)) throw new Error(bgpRetryMessage());
    throw new Error(output.trim().split('\n').slice(-8).join('\n') || `BGP failed: ${res.code}`);
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
    [Markup.button.callback('IP 信息', `ipinfo:${ip}`)],
  ]);
}

bot.start(async (ctx) => {
  if (!await guard(ctx)) return;
  await ctx.reply('发 IPv4 或域名，我会生成 IPPure / BGP 图，也可以用 /ip 查询文本信息。群里请 @我 再带上 IP/域名。');
});

bot.help(async (ctx) => {
  if (!await guard(ctx)) return;
  await ctx.reply([
    '用法：',
    '1. 私聊直接发送 IPv4 或域名',
    '2. 群聊 @BotName 1.1.1.1',
    '3. 选择 IPPure 图、BGP 图或 IP 信息',
    '4. /ip 8.8.8.8 可直接查询文本信息',
    '',
    '默认白名单模式；公开使用请设置 PUBLIC_ACCESS=true。',
  ].join('\n'));
});

bot.command('ip', async (ctx) => {
  if (!await guard(ctx)) return;
  const query = getCommandArg(ctx) || getReplyText(ctx);
  await replyIpInfo(ctx, query);
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

bot.action(/^ipinfo:((?:\d{1,3}\.){3}\d{1,3})$/, async (ctx) => {
  if (!await guard(ctx)) return;
  const ip = ctx.match[1];
  if (!isIpv4(ip)) {
    await ctx.answerCbQuery('无效 IPv4');
    return;
  }
  await ctx.answerCbQuery('正在查询…');
  try {
    const data = await getIpInfo(ip);
    await ctx.reply(formatIpInfo(data, ip), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
    });
  } catch (err) {
    await ctx.reply(`❌ 查询失败：${String(err?.message || err).slice(0, 900)}`);
  }
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
