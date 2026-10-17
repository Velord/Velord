#!/usr/bin/env node
'use strict';

// Regenerate the GitHub-profile Build Flight Recorder from public CI history.
// No percentages or synthetic run results; every tile corresponds to a GitHub Actions run.
const fs = require('node:fs');
const path = require('node:path');

const OWNER = 'Velord';
const REPOSITORY = 'HorizonBloom';
const WORKFLOW = 'verify.yml';
const RUN_LIMIT = 9;
const OUTPUT = path.resolve(__dirname, '../../assets/build-flight-recorder.svg');
const COLORS = {
  success: ['#75dcb3', '#15362f'],
  failure: ['#e1a17e', '#372822'],
  cancelled: ['#a8b6c4', '#222e3b'],
  in_progress: ['#95c6e9', '#173247'],
  queued: ['#95c6e9', '#173247'],
  pending: ['#95c6e9', '#173247'],
  skipped: ['#a8b6c4', '#222e3b'],
  unknown: ['#a8b6c4', '#222e3b'],
};

const escapeXml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function statusOf(record) {
  if (record.status !== 'completed') return String(record.status || 'pending');
  return String(record.conclusion || 'unknown');
}
function titleFor(status) {
  const titles = {
    success: 'PASS', failure: 'FAIL', cancelled: 'STOP', in_progress: 'RUN',
    queued: 'WAIT', pending: 'WAIT', skipped: 'SKIP',
  };
  return titles[status] || 'N/A';
}
function palette(status) {
  return COLORS[status] || COLORS.unknown;
}
function dateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid run creation date');
  return date.toISOString().slice(5, 16).replace('T', ' ');
}
function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid run date');
  return date.toISOString().slice(0, 10);
}
async function github(pathname) {
  const token = process.env.GITHUB_TOKEN || '';
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Velord-Profile-Build-Flight-Recorder',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  const url = 'https://api.github.com/repos/' + OWNER + '/' + REPOSITORY + pathname;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('GitHub API HTTP ' + response.status + ' for ' + pathname);
  return response.json();
}
function render(runs, jobs) {
  const newest = runs[0];
  const latestStatus = statusOf(newest);
  const successCount = runs.filter((run) => statusOf(run) === 'success').length;
  const failureCount = runs.filter((run) => statusOf(run) === 'failure').length;
  const startDay = dayLabel(runs[runs.length - 1].created_at);
  const endDay = dayLabel(newest.created_at);
  const latestJobs = ['android-desktop', 'ios'].map((name) =>
    jobs.find((job) => job.name === name) || { name, status: 'unknown', conclusion: null });
  const desc = 'Last ' + runs.length + ' public Verify workflow runs from ' + startDay + ' through ' +
    endDay + ': ' + successCount + ' successful, ' + failureCount + ' failed. ' +
    'Most recent Android/Desktop job ' + statusOf(latestJobs[0]) +
    '; iOS job ' + statusOf(latestJobs[1]) + '.';
  const parts = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="338" viewBox="0 0 1120 338" role="img" aria-labelledby="title description">',
    '<title id="title">HorizonBloom Build Flight Recorder</title>',
    '<desc id="description">' + escapeXml(desc) + '</desc>',
    '<defs>',
    '<linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0e1925"/><stop offset="1" stop-color="#0a111a"/></linearGradient>',
    '<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#88b2c9" stroke-opacity=".052"/></pattern>',
    '</defs>',
    '<rect width="1120" height="338" rx="16" fill="url(#base)"/>',
    '<rect width="1120" height="338" rx="16" fill="url(#grid)"/>',
    '<text x="35" y="42" fill="#78c9b6" font-family="Consolas,monospace" font-size="12" letter-spacing="2.2">HORIZONBLOOM / BUILD FLIGHT RECORDER</text>',
    '<text x="35" y="92" fill="#eaf3f7" font-family="Segoe UI,Arial,sans-serif" font-size="34" font-weight="720">Verification history</text>',
    '<text x="35" y="120" fill="#8ea5b8" font-family="Segoe UI,Arial,sans-serif" font-size="14">' +
      runs.length + ' public runs / ' + startDay + ' to ' + endDay + '</text>',
    '<rect x="773" y="38" width="311" height="99" rx="10" fill="#13282c" stroke="#34736c"/>',
  ];
  const mainColor = palette(latestStatus)[0];
  parts.push('<circle cx="797" cy="64" r="5" fill="' + mainColor + '"/>');
  parts.push('<text x="811" y="68" fill="' + mainColor +
    '" font-family="Consolas,monospace" font-size="13" letter-spacing="1">LATEST / ' +
    titleFor(latestStatus) + '</text>');
  for (const [index, job] of latestJobs.entries()) {
    const y = 97 + 23 * index;
    const s = statusOf(job);
    parts.push('<text x="797" y="' + y + '" fill="#dcebea" font-family="Segoe UI,Arial,sans-serif" font-size="14">' +
      (index === 0 ? 'Android / Desktop' : 'iOS') + '</text>');
    parts.push('<text x="1059" y="' + y + '" text-anchor="end" fill="' +
      palette(s)[0] + '" font-family="Consolas,monospace" font-size="13">' + titleFor(s) + '</text>');
  }
  parts.push('<path d="M35 158H1085" stroke="#314454"/>');
  parts.push('<text x="35" y="184" fill="#8da1b2" font-family="Consolas,monospace" font-size="11" letter-spacing="1.1">EARLIER</text>');
  parts.push('<text x="1085" y="184" text-anchor="end" fill="#8da1b2" font-family="Consolas,monospace" font-size="11" letter-spacing="1.1">LATEST</text>');
  for (const [index, run] of [...runs].reverse().entries()) {
    const x = 35 + index * 117;
    const status = statusOf(run);
    const [color, background] = palette(status);
    parts.push('<rect x="' + x + '" y="200" width="101" height="62" rx="7" fill="' +
      background + '" stroke="' + color + '" stroke-opacity=".64"><title>' +
      escapeXml(dateLabel(run.created_at) + ' UTC / ' + status + ' / ' + run.html_url) + '</title></rect>');
    parts.push('<text x="' + (x + 50) + '" y="227" fill="' + color +
      '" font-family="Consolas,monospace" font-size="15" text-anchor="middle" font-weight="bold">' +
      titleFor(status) + '</text>');
    parts.push('<text x="' + (x + 50) +
      '" y="246" fill="#abbccc" font-family="Consolas,monospace" font-size="10" text-anchor="middle">' +
      dateLabel(run.created_at) + '</text>');
  }
  parts.push('<circle cx="44" cy="298" r="5" fill="#75dcb3"/>');
  parts.push('<text x="58" y="303" fill="#9db0be" font-family="Segoe UI,Arial,sans-serif" font-size="12">Successful run</text>');
  parts.push('<circle cx="211" cy="298" r="5" fill="#e1a17e"/>');
  parts.push('<text x="226" y="303" fill="#9db0be" font-family="Segoe UI,Arial,sans-serif" font-size="12">Failed run</text>');
  parts.push('<circle cx="354" cy="298" r="5" fill="#95c6e9"/>');
  parts.push('<text x="368" y="303" fill="#9db0be" font-family="Segoe UI,Arial,sans-serif" font-size="12">Running / queued</text>');
  parts.push('<text x="1085" y="303" text-anchor="end" fill="#7e95a8" font-family="Consolas,monospace" font-size="11">SOURCE: PUBLIC GITHUB ACTIONS</text>');
  parts.push('</svg>');
  return parts.join('\n') + '\n';
}
async function main() {
  const data = await github('/actions/workflows/' + WORKFLOW + '/runs?per_page=' + RUN_LIMIT);
  if (!Array.isArray(data.workflow_runs) || data.workflow_runs.length === 0) {
    throw new Error('No public verification runs received; retaining previous chart');
  }
  const runs = data.workflow_runs.slice(0, RUN_LIMIT);
  for (const run of runs) {
    if (!run.id || !run.created_at || !run.html_url) throw new Error('Incomplete workflow-run data');
  }
  const latest = await github('/actions/runs/' + runs[0].id + '/jobs?per_page=100');
  if (!Array.isArray(latest.jobs)) throw new Error('Latest CI jobs not returned');
  const contents = render(runs, latest.jobs);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, contents, 'utf8');
  console.log('Build Flight Recorder updated from ' + runs.length + ' public Verify workflow runs.');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
