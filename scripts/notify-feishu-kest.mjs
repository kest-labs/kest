#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const reportPath = process.argv[2] || '.kest/reports/flow-results.json';
const webhook = (process.env.FEISHU_WEBHOOK || '').trim();
const secret = (process.env.FEISHU_SECRET || '').trim();
const kestResult = (process.env.KEST_RESULT || '').trim();

if (!webhook) {
  console.log('FEISHU_WEBHOOK is not set; skipping Feishu notification.');
  process.exit(0);
}

function githubRunURL() {
  const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY || '';
  const runID = process.env.GITHUB_RUN_ID || '';
  if (!repo || !runID) {
    return '';
  }
  return `${server}/${repo}/actions/runs/${runID}`;
}

function shortSHA(value) {
  if (!value) {
    return 'unknown';
  }
  return value.slice(0, 7);
}

function branchName() {
  return process.env.GITHUB_HEAD_REF || (process.env.GITHUB_REF_NAME || 'unknown');
}

function durationText(ms) {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '0s';
  }
  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }
  return `${(value / 1000).toFixed(1)}s`;
}

function failedFlowLines(report) {
  const flows = Array.isArray(report.flows) ? report.flows : [];
  const failed = flows
    .filter((flow) => flow && flow.status !== 'passed')
    .slice(0, 8)
    .map((flow) => {
      const name = flow.source_name || basename(flow.source_path || 'unknown.flow.md');
      const failedSteps = Number(flow.failed_steps || 0);
      const error = flow.error ? ` (${flow.error})` : '';
      return `- ${name}: ${failedSteps} failed step(s)${error}`;
    });

  if (failed.length === 0) {
    return '- none';
  }

  const totalFailed = flows.filter((flow) => flow && flow.status !== 'passed').length;
  if (totalFailed > failed.length) {
    failed.push(`- ...and ${totalFailed - failed.length} more failed flow(s)`);
  }
  return failed.join('\n');
}

async function loadReport(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function buildMessage(report, reportMissingError) {
  const repo = process.env.GITHUB_REPOSITORY || 'unknown';
  const runURL = githubRunURL();
  const sha = shortSHA(process.env.GITHUB_SHA || '');
  const outcome = reportMissingError
    ? 'failed'
    : Number(report.failed_flows || 0) > 0 || kestResult === 'failure'
      ? 'failed'
      : 'passed';
  const title = outcome === 'passed' ? 'Kest Flow CI passed' : 'Kest Flow CI failed';

  if (reportMissingError) {
    return [
      title,
      `Repo: ${repo}`,
      `Branch: ${branchName()}`,
      `Commit: ${sha}`,
      `Profile: ${process.env.KEST_PROFILE || 'ci'}`,
      'Result: build/startup failed before Kest report was generated.',
      `Error: ${reportMissingError.message}`,
      runURL ? `Run: ${runURL}` : '',
    ].filter(Boolean).join('\n');
  }

  return [
    title,
    `Repo: ${repo}`,
    `Branch: ${branchName()}`,
    `Commit: ${sha}`,
    `Profile: ${report.profile || process.env.KEST_PROFILE || 'ci'}`,
    report.base_url ? `Base URL: ${report.base_url}` : '',
    `Flows: ${report.total_flows || 0} total, ${report.passed_flows || 0} passed, ${report.failed_flows || 0} failed`,
    `Steps: ${report.total_steps || 0} total, ${report.passed_steps || 0} passed, ${report.failed_steps || 0} failed`,
    `Duration: ${durationText(report.duration_ms)}`,
    outcome === 'passed' ? '' : `Failed flows:\n${failedFlowLines(report)}`,
    runURL ? `Run: ${runURL}` : '',
  ].filter(Boolean).join('\n');
}

function signedFields() {
  if (!secret) {
    return {};
  }
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = `${timestamp}\n${secret}`;
  const sign = createHmac('sha256', key).update('').digest('base64');
  return { timestamp, sign };
}

async function send(text) {
  const payload = {
    ...signedFields(),
    msg_type: 'text',
    content: { text },
  };

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Feishu webhook returned HTTP ${response.status}: ${body}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed.code === 'number' && parsed.code !== 0) {
    throw new Error(`Feishu webhook returned code ${parsed.code}: ${parsed.msg || body}`);
  }

  console.log('Feishu notification sent.');
}

let report = null;
let reportError = null;
try {
  report = await loadReport(reportPath);
} catch (error) {
  reportError = error;
}

await send(buildMessage(report || {}, reportError));
