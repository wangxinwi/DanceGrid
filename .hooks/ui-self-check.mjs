#!/usr/bin/env node

import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const UI_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.css', '.scss', '.sass', '.less', '.html', '.htm', '.vue', '.svelte', '.astro']);
const WORKSPACE_NODE_CANDIDATES = [
  '/Users/vidawung/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node',
  process.env.CODEX_NODE_PATH,
  process.execPath,
];

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function safeParse(input) {
  if (!input.trim()) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function collectPaths(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectPaths(item, out);
    return out;
  }
  for (const key of ['file_path', 'path', 'target_file', 'filePath', 'targetFile', 'files', 'paths']) {
    collectPaths(value[key], out);
  }
  return out;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').trim();
}

function isUiPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return UI_EXTS.has(ext);
}

function extractTouchedFiles(event) {
  const files = new Set();
  const direct = [
    event?.file_path,
    event?.path,
    event?.target_file,
    event?.filePath,
    event?.targetFile,
    event?.tool_input?.file_path,
    event?.tool_input?.path,
    event?.tool_input?.target_file,
    event?.tool_input?.filePath,
    event?.tool_input?.targetFile,
  ];

  for (const item of direct) {
    for (const value of asArray(item)) {
      if (typeof value === 'string' && value.trim()) files.add(normalizePath(value));
    }
  }

  for (const value of collectPaths(event?.tool_input)) {
    const normalized = normalizePath(value);
    if (normalized) files.add(normalized);
  }

  if (event?.tool_name === 'apply_patch' && typeof event?.tool_input?.command === 'string') {
    const re = /^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/gm;
    let match;
    while ((match = re.exec(event.tool_input.command))) {
      const filePath = normalizePath(match[1]);
      if (filePath) files.add(filePath);
    }
  }

  return Array.from(files).filter(isUiPath);
}

function buildMessage(type, lines) {
  return [`[ui-self-check] ${type}`, ...lines.map((line) => `- ${line}`)].join('\n');
}

function resolveNodeBinary() {
  for (const candidate of WORKSPACE_NODE_CANDIDATES) {
    if (typeof candidate === 'string' && candidate && fs.existsSync(candidate)) return candidate;
  }
  return process.execPath;
}

async function runBuild(cwd) {
  const nodeBinary = resolveNodeBinary();
  const viteCliCandidates = [
    path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js'),
    path.join(cwd, 'node_modules', 'vite', 'dist', 'node', 'cli.js'),
  ];
  const viteCli = viteCliCandidates.find((candidate) => fs.existsSync(candidate));
  if (!viteCli) {
    return {
      ok: false,
      stdout: '',
      stderr: 'Could not locate Vite CLI in node_modules.',
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(nodeBinary, [viteCli, 'build'], {
      cwd,
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    return {
      ok: true,
      stdout: String(stdout || '').trim(),
      stderr: String(stderr || '').trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error?.stdout || '').trim(),
      stderr: String(error?.stderr || error?.message || '').trim(),
    };
  }
}

async function main() {
  const stdin = await readStdin();
  const event = safeParse(stdin);
  if (!event || typeof event !== 'object') process.exit(0);

  const files = extractTouchedFiles(event);
  if (files.length === 0) process.exit(0);

  const build = await runBuild(process.cwd());
  if (!build.ok) {
    process.stdout.write(buildMessage('Build failed before delivery', [
      'Fix the build errors before responding to the user.',
      'Recheck the edited UI files and rerun the change.',
      build.stderr || 'No build output captured.',
    ]));
    process.exit(0);
  }

  process.stdout.write(buildMessage('Pre-delivery self-check passed', [
    `Build succeeded after editing: ${Array.from(new Set(files)).join(', ')}`,
    'Open the app in the built-in browser, capture a screenshot, and verify the screen matches the requested UI behavior before telling the user it is done.',
    'Check hierarchy, spacing, typography, colors, and mobile fit against AGENTS.md and prd-v0.1.md.',
  ]));
  process.exit(0);
}

main().catch((error) => {
  process.stdout.write(buildMessage('Self-check skipped due to internal error', [
    String(error?.message || error || 'unknown error'),
    'Continue only after a built-in browser check and screenshot review if the change affects UI.',
  ]));
  process.exit(0);
});
