#!/usr/bin/env node
'use strict';

// Public-authored commits, grouped by the hour of authoring in Europe/Kyiv.
// Uses the supported GitHub REST Commits API, not removed PushEvent payload fields.
const fs = require('node:fs');
const path = require('node:path');

const USER = 'Velord';
const TIME_ZONE = 'Europe/Kyiv';
const WINDOW_DAYS = 90;
const OUTPUT = path.resolve(__dirname, '../../assets/activity-by-hour.svg');
const WIDTH = 1120;
const HEIGHT = 340;
const DAY_MS = 86400000;

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function request(endpoint) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Velord-Profile-Hourly-Commits',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const response = await fetch('https://api.github.com' + endpoint, {
    headers, signal: AbortSignal.timeout(20000),
  });
  if (response.status === 409) return [];
  if (!response.ok) throw new Error('GitHub API ' + response.status + ' at ' + endpoint.split('?')[0]);
  return response.json();
}

function authoredHour(dateString) {
  const timestamp = new Date(dateString);
  if (Number.isNaN(timestamp.getTime())) throw new Error('Invalid public commit timestamp');
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23',
  });
  const part = format.formatToParts(timestamp).find((item) => item.type === 'hour');
  const hour = Number(part?.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('Invalid hour conversion');
  return hour;
}

function render(hours, data) {
  const peak = Math.max(...hours, 1);
  const peakHour = hours.indexOf(peak);
  const sum = hours.reduce((acc, number) => acc + number, 0);
  const sinceLabel = data.since.toISOString().slice(0, 10);
  const throughLabel = data.until.toISOString().slice(0, 10);
  const output = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + HEIGHT +
      '" viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" role="img" aria-labelledby="title description">',
    '<title id="title">GitHub public commit activity by local hour</title>',
    '<desc id="description">Last 90 days, ' + TIME_ZONE + '. ' + sum +
      ' authored commits from ' + data.repositories + ' public repositories. ' +
      'Peak at ' + String(peakHour).padStart(2, '0') + ':00 with ' + peak + ' commits. ' +
      'These are public commits, not working hours or private coding activity.</desc>',
    '<defs><linearGradient id="surface" x1="0" y1="0" x2="1" y2="1">' +
      '<stop stop-color="#101b28"/><stop offset="1" stop-color="#0a121b"/></linearGradient>' +
      '<linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">' +
      '<stop stop-color="#33566c"/><stop offset="1" stop-color="#83c9be"/></linearGradient></defs>',
    '<rect width="' + WIDTH + '" height="' + HEIGHT + '" rx="14" fill="url(#surface)"/>',
    '<text x="34" y="35" fill="#7ebdb4" font-family="Consolas,monospace" font-size="12" letter-spacing="1.9">RECENT PUBLIC COMMITS / LOCAL TIME</text>',
    '<text x="34" y="71" fill="#f1f5f9" font-family="Segoe UI,Arial,sans-serif" font-size="28" font-weight="700">Activity by hour</text>',
    '<text x="1084" y="43" text-anchor="end" fill="#acc0cc" font-family="Consolas,monospace" font-size="12">' +
      data.repositories + ' REPOSITORIES · ' + sum + ' COMMITS</text>',
    '<text x="1084" y="69" text-anchor="end" fill="#85a2b1" font-family="Segoe UI,Arial,sans-serif" font-size="13">Last ' +
      WINDOW_DAYS + ' days · ' + TIME_ZONE + '</text>',
  ];
  for (let grid = 0; grid <= 3; grid++) {
    const y = 111 + grid * 50;
    output.push('<path d="M34 ' + y + 'H1085" stroke="#314758" stroke-opacity=".42"/>');
  }
  const base = 261;
  for (let hour = 0; hour < 24; hour++) {
    const x = 40 + hour * 44;
    const height = Math.round((hours[hour] / peak) * 135);
    const y = base - height;
    const peakColor = hour === peakHour && peak > 0;
    const fill = peakColor ? '#e8b995' : 'url(#bar)';
    const label = String(hour).padStart(2, '0');
    output.push('<rect x="' + x + '" y="' + (base - 146) + '" width="27" height="146" rx="3" fill="#1a2a37" opacity=".68"/>');
    output.push('<rect x="' + x + '" y="' + y + '" width="27" height="' + height +
      '" rx="3" fill="' + fill + '"><title>' + escapeXml(label + ':00–' + label +
      ':59 · ' + hours[hour] + ' authored commits') + '</title></rect>');
    output.push('<text x="' + (x + 13.5) + '" y="283" fill="#b4c5d2" font-family="Consolas,monospace" font-size="11" text-anchor="middle">' + label + '</text>');
  }
  output.push('<path d="M34 261H1085" stroke="#7897a7" stroke-opacity=".5"/>');
  output.push('<text x="34" y="315" fill="#8da3b4" font-family="Segoe UI,Arial,sans-serif" font-size="12">Authored ' +
    sinceLabel + ' – ' + throughLabel + ' · ' + TIME_ZONE + ' (DST-aware)</text>');
  output.push('<text x="1084" y="315" text-anchor="end" fill="#8da3b4" font-family="Segoe UI,Arial,sans-serif" font-size="12">Public commits only · Not hours worked</text>');
  output.push('</svg>');
  return output.join('\n') + '\n';
}

async function main() {
  const until = new Date();
  const since = new Date(until.getTime() - WINDOW_DAYS * DAY_MS);
  const repos = await request('/users/' + USER + '/repos?per_page=100&type=owner');
  if (!Array.isArray(repos)) throw new Error('GitHub did not return user repositories');
  const active = repos.filter((repo) =>
    !repo.private && !repo.archived && !repo.fork &&
    repo.pushed_at && new Date(repo.pushed_at) >= since);
  if (active.length === 0) throw new Error('No active public repositories; refusing to overwrite chart');
  const hours = new Array(24).fill(0);
  const unique = new Set();
  let contributors = 0;
  for (const repo of active) {
    let ownCount = 0;
    for (let page = 1; page <= 10; page++) {
      const endpoint = '/repos/' + encodeURIComponent(USER) + '/' +
        encodeURIComponent(repo.name) + '/commits?author=' + encodeURIComponent(USER) +
        '&since=' + encodeURIComponent(since.toISOString()) +
        '&until=' + encodeURIComponent(until.toISOString()) + '&per_page=100&page=' + page;
      const commits = await request(endpoint);
      if (!Array.isArray(commits)) throw new Error('Incomplete public commit response for ' + repo.name);
      for (const commit of commits) {
        const authored = commit.commit?.author?.date;
        if (!authored || !commit.sha) continue;
        const when = new Date(authored);
        if (when < since || when > until) continue;
        const key = repo.name + '/' + commit.sha;
        if (unique.has(key)) continue;
        unique.add(key);
        hours[authoredHour(authored)]++;
        ownCount++;
      }
      if (commits.length < 100) break;
      if (page === 10) throw new Error('Truncated commit history for ' + repo.name);
    }
    if (ownCount > 0) contributors++;
  }
  if (!unique.size) throw new Error('No public authored commits in 90 days; refusing to overwrite chart');
  const image = render(hours, {since, until, repositories: contributors});
  fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
  fs.writeFileSync(OUTPUT, image, 'utf8');
  console.log('Hourly chart created from ' + unique.size +
    ' public authored commits across ' + contributors + ' repositories; peak hour ' +
    hours.indexOf(Math.max(...hours)) + ', peak count ' + Math.max(...hours) + '.');
}

main().catch((error) => {
  console.error('Activity chart not updated: ' + error.message);
  process.exitCode = 1;
});
