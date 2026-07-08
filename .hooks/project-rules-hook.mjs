#!/usr/bin/env node

const protectedFiles = new Set([
  'AGENTS.md',
  'prd-v0.1.md',
  'prd.md',
  'prd-test.md',
  'docs/ui-stack.md',
  '.claude/settings.local.json',
  '.codex/hooks.json',
  '.cursor/hooks.json',
  '.impeccable/config.json',
  '.impeccable/config.local.json',
]);

const protectedSuffixes = [
  '/AGENTS.md',
  '/prd-v0.1.md',
  '/prd.md',
  '/prd-test.md',
  '/docs/ui-stack.md',
  '/.claude/settings.local.json',
  '/.codex/hooks.json',
  '/.cursor/hooks.json',
  '/.impeccable/config.json',
  '/.impeccable/config.local.json',
];

const mode = (process.argv[2] || 'post').toLowerCase();
const approvedImports = [
  'shadcn/ui',
  'radix-ui',
  'lucide-react',
];

const bannedImports = [
  'antd',
  '@mui/',
  'material-ui',
  '@chakra-ui/',
  'mantine',
  'blueprintjs',
  'evergreen-ui',
  'semantic-ui',
  'react-bootstrap',
  'font-awesome',
  '@fortawesome/',
  'heroicons',
  'tabler-icons',
  'remixicon',
  'bootstrap-icons',
];

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function safeParse(json) {
  if (!json.trim()) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePath(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function matchesProtectedPath(value) {
  const normalized = normalizePath(value);
  if (!normalized) return false;
  if (protectedFiles.has(normalized)) return true;
  return protectedSuffixes.some((suffix) => normalized.endsWith(suffix));
}

function collectPathStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    for (const item of value) collectPathStrings(item, out);
    return out;
  }
  for (const key of ['file_path', 'path', 'target_file', 'filePath', 'targetFile', 'files', 'paths']) {
    collectPathStrings(value[key], out);
  }
  return out;
}

function collectImports(text) {
  if (typeof text !== 'string' || !text) return [];
  const results = [];
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRe.exec(text))) results.push(match[1]);
  const dynamicImportRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRe.exec(text))) results.push(match[1]);
  return results;
}

function isBannedImport(specifier) {
  const lowered = String(specifier || '').toLowerCase();
  return bannedImports.some((pattern) => lowered.includes(pattern));
}

function isApprovedImport(specifier) {
  const lowered = String(specifier || '').toLowerCase();
  return approvedImports.some((pattern) => lowered.includes(pattern));
}

function summarizeImportIssues(event) {
  const texts = [];
  const directTexts = [
    event?.tool_input?.content,
    event?.tool_input?.text,
    event?.tool_input?.command,
    event?.content,
    event?.text,
    event?.command,
  ];
  for (const item of directTexts) {
    if (typeof item === 'string' && item.trim()) texts.push(item);
  }

  const imports = [];
  for (const text of texts) {
    imports.push(...collectImports(text));
  }

  const banned = [];
  const approved = [];
  for (const specifier of imports) {
    if (isBannedImport(specifier)) banned.push(specifier);
    if (isApprovedImport(specifier)) approved.push(specifier);
  }

  return { imports, banned, approved };
}

function extractCandidatePaths(event) {
  const paths = new Set();
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
      if (typeof value === 'string' && value.trim()) paths.add(normalizePath(value));
    }
  }

  const toolInput = event?.tool_input;
  if (toolInput && typeof toolInput === 'object') {
    for (const value of collectPathStrings(toolInput)) {
      if (matchesProtectedPath(value)) paths.add(normalizePath(value));
    }
  }

  if (event?.tool_name === 'apply_patch' && typeof event?.tool_input?.command === 'string') {
    const patch = event.tool_input.command;
    const re = /^\*\*\* (?:Add|Update|Delete) File:\s+(.+)$/gm;
    let match;
    while ((match = re.exec(patch))) {
      const candidate = normalizePath(match[1]);
      if (candidate) paths.add(candidate);
    }
  }

  const flattened = [];
  for (const value of paths) {
    if (value) flattened.push(value);
  }
  return flattened;
}

function findProtectedPaths(event) {
  const candidates = extractCandidatePaths(event);
  return candidates.filter(matchesProtectedPath);
}

function formatReminder(paths) {
  const unique = Array.from(new Set(paths));
  return [
    '[project-rules] Protected project files changed:',
    ...unique.map((file) => `- ${file}`),
    '',
    'Re-read AGENTS.md and prd-v0.1.md before continuing. Preserve the v0.1 scope, local-first constraint, and UI rules.',
  ].join('\n');
}

function formatImportReminder(banned, approved) {
  const lines = [
    '[project-rules] UI stack import check:',
    ...Array.from(new Set(banned)).map((item) => `- disallowed import: ${item}`),
  ];
  lines.push('', 'Use shadcn/ui, Radix UI, and Lucide for the UI stack unless the task explicitly requests otherwise.');
  return lines.join('\n');
}

function denyImport(banned) {
  const message = formatImportReminder(banned, []);
  process.stdout.write(JSON.stringify({
    permission: 'deny',
    user_message: message,
    agent_message: message,
  }));
  process.exit(0);
}

function allow() {
  if (mode === 'pre') {
    process.stdout.write(JSON.stringify({ permission: 'allow' }));
  }
  process.exit(0);
}

function deny(paths) {
  const message = formatReminder(paths);
  process.stdout.write(JSON.stringify({
    permission: 'deny',
    user_message: message,
    agent_message: message,
  }));
  process.exit(0);
}

async function main() {
  const stdin = await readStdin();
  const event = safeParse(stdin);
  if (!event || typeof event !== 'object') return allow();

  const { banned, approved } = summarizeImportIssues(event);
  const protectedPaths = findProtectedPaths(event);
  const hasImportViolation = banned.length > 0;
  const hasProtectedPath = protectedPaths.length > 0;

  if (mode === 'pre') {
    if (hasProtectedPath) return deny(protectedPaths);
    if (hasImportViolation) return denyImport(Array.from(new Set(banned)));
    return allow();
  }

  if (hasImportViolation) {
    process.stdout.write(formatImportReminder(banned, approved));
    process.exit(0);
  }

  if (hasProtectedPath) {
    process.stdout.write(formatReminder(protectedPaths));
    process.exit(0);
  }

  allow();
}

main().catch(() => {
  allow();
});
