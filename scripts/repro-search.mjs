#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '1';
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv);
const apiBase = args.api || 'https://ikea-second-hand-alerts.ikea-second-hand-alerts.workers.dev';
const query = (args.query || '').trim();
const stores = (args.stores || '').split(',').map((item) => item.trim()).filter(Boolean);

if (!query || stores.length < 2) {
  console.error('Usage: node scripts/repro-search.mjs --query "billy shelf" --stores "294,203" [--api "..."]');
  process.exit(1);
}

async function runCase(label, storeIds) {
  const params = new URLSearchParams({
    languageCode: 'pl',
    size: '32',
    allPages: '1',
    debug: '1',
    storeIds: storeIds.join(','),
    query
  });
  const url = `${apiBase}/api/items?${params.toString()}`;
  const response = await fetch(url);
  const body = await response.json();
  const offers = Array.isArray(body?.content) ? body.content : [];
  return {
    label,
    url,
    status: response.status,
    count: offers.length,
    sampleIds: offers.slice(0, 10).map((offer) => offer?.id || offer?.offerId || offer?.articleNumber || 'unknown'),
    debug: body?.debug || null
  };
}

const cases = [
  ...stores.map((storeId) => ({ label: `store:${storeId}`, storeIds: [storeId] })),
  { label: `stores:${stores.join('+')}`, storeIds: stores }
];

const results = [];
for (const entry of cases) {
  results.push(await runCase(entry.label, entry.storeIds));
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(process.cwd(), 'artifacts/search-debug');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${timestamp}-${query.replace(/\s+/g, '_').slice(0, 40)}.json`);
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      apiBase,
      query,
      stores,
      results
    },
    null,
    2
  )
);

console.log(`Saved snapshot: ${outFile}`);
for (const row of results) {
  console.log(`${row.label}: count=${row.count} status=${row.status}`);
}
