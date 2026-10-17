// Regenerate the 2026 profile timeline from GitHub's public contribution calendar.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const YEAR = 2026;
const URL = 'https://github.com/users/Velord/contributions?from=2026-01-01&to=2026-12-31';
const OUTPUT = path.resolve(__dirname, '../../assets/timeline-2026.svg');
const WEEKDAY_OUTPUT = path.resolve(__dirname, '../../assets/weekday-activity-2026.svg');
const COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
const DAY_MS = 86400000;
const iso = (date) => date.toISOString().slice(0, 10);
const escapeXml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function loadContributions() {
  const response = await fetch(URL, { headers: { 'User-Agent': 'Velord-Profile-Timeline' } });
  if (!response.ok) throw new Error('GitHub contribution fetch: HTTP ' + response.status);
  const body = await response.text();
  const expression = /<td\b(?=[^>]*data-date="(2026-\d\d-\d\d)")(?=[^>]*data-level="([0-4])")[^>]*>\s*<\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/g;
  const days = new Map();
  for (const match of body.matchAll(expression)) {
    const tooltip = match[3].replace(/<[^>]*>/g, '').trim();
    const quantity = tooltip.match(/\b(\d+) contributions?\b/);
    if (!quantity && !tooltip.includes('No contributions')) {
      throw new Error('Unrecognized GitHub contribution tooltip: ' + tooltip.slice(0, 80));
    }
    days.set(match[1], { count: quantity ? Number(quantity[1]) : 0, level: Number(match[2]) });
  }
  if (days.size < 250) throw new Error('Only ' + days.size + ' contribution cells; refusing to replace chart');
  return days;
}

function draw(days) {
  const first = new Date(Date.UTC(YEAR, 0, 1));
  const last = new Date(Date.UTC(YEAR, 11, 31));
  const start = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  const today = iso(new Date()) < iso(last) ? iso(new Date()) : iso(last);
  const columns = Math.floor((last - start) / (7 * DAY_MS)) + 1;
  const left = 50, top = 69, gap = 17, cell = 13;
  const width = left + columns * gap + 28;
  const count = [...days.entries()].filter(([date]) => date <= today).map(([, value]) => value.count);
  const total = count.reduce((a, b) => a + b, 0);
  const active = count.filter((value) => value > 0).length;
  const result = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="242" viewBox="0 0 ' + width + ' 242" role="img" aria-labelledby="title desc">',
    '<title id="title">GitHub contributions in 2026</title>',
    '<desc id="desc">' + total + ' contributions across ' + active + ' active days through ' + today + '.</desc>',
    '<rect width="' + width + '" height="242" rx="12" fill="#0d1117"/>',
    '<text x="22" y="30" font-family="sans-serif" font-size="18" font-weight="bold" fill="#e6edf3">Timeline · 2026</text>',
    '<text x="' + (width - 22) + '" y="30" text-anchor="end" font-family="sans-serif" font-size="12" fill="#8b949e">' + total.toLocaleString('en-US') + ' contributions · ' + active + ' active days</text>'
  ];
  for (let month = 0; month < 12; month++) {
    const firstOfMonth = new Date(Date.UTC(YEAR, month, 1));
    const column = Math.floor((firstOfMonth - start) / (7 * DAY_MS));
    const name = firstOfMonth.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    result.push('<text x="' + (left + column * gap) + '" y="55" font-family="sans-serif" font-size="11" fill="#8b949e">' + name + '</text>');
  }
  for (const [row, label] of [[0, 'Sun'], [2, 'Tue'], [4, 'Thu'], [6, 'Sat']]) {
    result.push('<text x="12" y="' + (top + row * gap + 11) + '" font-family="sans-serif" font-size="10" fill="#8b949e">' + label + '</text>');
  }
  for (let timestamp = start.getTime(); timestamp <= last.getTime(); timestamp += DAY_MS) {
    const day = new Date(timestamp);
    const date = iso(day);
    const column = Math.floor((timestamp - start.getTime()) / (7 * DAY_MS));
    const row = day.getUTCDay();
    const x = left + column * gap, y = top + row * gap;
    const value = days.get(date) || { count: 0, level: 0 };
    const recorded = date >= '2026-01-01' && date <= today;
    const color = recorded ? COLORS[Math.min(4, value.level)] : '#0d1117';
    const description = recorded ? (value.count + ' contribution' + (value.count === 1 ? '' : 's') + ' on ' + date) : 'Outside recorded 2026 period: ' + date;
    result.push('<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="2" fill="' + color + '" stroke="#30363d" stroke-width=".5"><title>' + escapeXml(description) + '</title></rect>');
  }
  result.push('<text x="22" y="222" font-family="sans-serif" font-size="11" fill="#8b949e">GitHub contribution calendar · through ' + today + '</text>');
  result.push('<text x="' + (width - 159) + '" y="221" font-family="sans-serif" font-size="10" fill="#8b949e">Less</text>');
  for (const [level, color] of COLORS.entries()) {
    result.push('<rect x="' + (width - 130 + level * 17) + '" y="210" width="13" height="13" rx="2" fill="' + color + '"/>');
  }
  result.push('<text x="' + (width - 42) + '" y="221" font-family="sans-serif" font-size="10" fill="#8b949e">More</text>');
  result.push('</svg>');
  return result.join('\n') + '\n';
}

function drawWeekdays(days) {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const totals = new Array(7).fill(0);
  const activeDays = new Array(7).fill(0);
  const today = iso(new Date()) < '2026-12-31' ? iso(new Date()) : '2026-12-31';

  for (const [day, value] of days) {
    if (day < '2026-01-01' || day > today) continue;
    const weekday = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7;
    totals[weekday] += value.count;
    if (value.count > 0) activeDays[weekday]++;
  }

  const max = Math.max(1, ...totals);
  const total = totals.reduce((sum, count) => sum + count, 0);
  const entries = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="376" viewBox="0 0 1120 376" role="img" aria-labelledby="title desc">',
    '<title id="title">2026 GitHub contributions by weekday</title>',
    '<desc id="desc">' + total + ' contributions from January 1 through ' + today +
      '. Monday through Sunday counts: ' + totals.join(', ') + '. Counts are contributions, not hours worked.</desc>',
    '<defs>',
    '<linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#111b27"/><stop offset="1" stop-color="#0a1119"/></linearGradient>',
    '<linearGradient id="bars" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#375c69"/><stop offset="1" stop-color="#93c6bc"/></linearGradient>',
    '</defs>',
    '<rect width="1120" height="376" rx="14" fill="url(#background)"/>',
    '<text x="34" y="37" fill="#87b9b0" font-family="Consolas,monospace" font-size="12" letter-spacing="2.1">2026 / ACTIVITY BY WEEKDAY</text>',
    '<text x="34" y="73" fill="#f0f5f8" font-family="Segoe UI,Arial,sans-serif" font-weight="650" font-size="26">When contributions happen</text>',
    '<text x="1087" y="74" text-anchor="end" fill="#a7b5c4" font-family="Consolas,monospace" font-size="13">' +
      total.toLocaleString('en-US') + ' total contributions</text>',
    '<path d="M34 278H1087" fill="none" stroke="#556979" stroke-opacity=".65"/>'
  ];

  for (let index = 0; index < names.length; index++) {
    const x = 57 + index * 151;
    const barWidth = 75;
    const height = Math.round((totals[index] / max) * 146);
    const y = 278 - height;
    const color = totals[index] === max && totals[index] > 0 ? '#e9bc98' : 'url(#bars)';
    entries.push('<rect x="' + x + '" y="' + y + '" width="' + barWidth +
      '" height="' + height + '" rx="6" fill="' + color + '"><title>' +
      escapeXml(names[index] + ': ' + totals[index] + ' contributions; ' + activeDays[index] + ' active days') +
      '</title></rect>');
    entries.push('<text x="' + (x + barWidth / 2) + '" y="' + (y - 13) +
      '" text-anchor="middle" fill="#e7f0f4" font-family="Consolas,monospace" font-size="16" font-weight="bold">' +
      totals[index].toLocaleString('en-US') + '</text>');
    entries.push('<text x="' + (x + barWidth / 2) + '" y="306" text-anchor="middle" fill="#d8e2e9" font-family="Segoe UI,Arial,sans-serif" font-size="14">' +
      names[index] + '</text>');
    entries.push('<text x="' + (x + barWidth / 2) + '" y="326" text-anchor="middle" fill="#839cad" font-family="Consolas,monospace" font-size="11">' +
      activeDays[index] + ' active days</text>');
  }
  entries.push('<text x="34" y="358" fill="#758c9e" font-family="Segoe UI,Arial,sans-serif" font-size="11">GitHub contribution calendar · through ' +
    today + ' · Counts reflect contributions, not hours of coding</text>');
  entries.push('</svg>');
  return entries.join('\n') + '\n';
}

loadContributions().then((days) => {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, draw(days), 'utf8');
  fs.writeFileSync(WEEKDAY_OUTPUT, drawWeekdays(days), 'utf8');
  console.log('Generated 2026 timeline and weekday breakdown from ' + days.size + ' dated cells.');
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
