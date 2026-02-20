#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const workerBase = process.env.WORKER_BASE_URL || 'https://ikea-second-hand-alerts.ikea-second-hand-alerts.workers.dev';
const expectedAlertId = process.env.CANARY_ALERT_ID || '';
const outputDir = process.env.CANARY_OUTPUT_DIR || path.resolve(process.cwd(), 'artifacts/canary');

async function run() {
  const url = `${workerBase}/api/run-alerts?dryRun=1&debug=1`;
  const response = await fetch(url, { method: 'POST' });
  const body = await response.json();
  const summary = body?.summary || {};
  const subscriptions = Array.isArray(summary.subscriptions) ? summary.subscriptions : [];

  const alertSeen = expectedAlertId
    ? subscriptions.some((sub) =>
        Array.isArray(sub.alerts) && sub.alerts.some((alert) => alert.alertId === expectedAlertId)
      )
    : true;

  const result = {
    checkedAt: new Date().toISOString(),
    ok: response.ok,
    status: response.status,
    workerBase,
    expectedAlertId: expectedAlertId || null,
    alertSeen,
    summary
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`Canary snapshot written to: ${outputPath}`);
  console.log(`Response status: ${response.status}`);
  console.log(`Subscriptions processed: ${summary.subscriptionsProcessed || 0}`);
  console.log(`Alerts evaluated: ${summary.alertsEvaluated || 0}`);
  if (expectedAlertId) {
    console.log(`Expected alert "${expectedAlertId}" seen: ${alertSeen}`);
  }

  if (!response.ok) process.exit(1);
  if (!alertSeen) process.exit(2);
}

run().catch((err) => {
  console.error('Canary check failed:', err?.message || err);
  process.exit(1);
});
