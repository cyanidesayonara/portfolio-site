#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const META_PATH = path.join(REPO_ROOT, 'src', 'data', 'project-meta.json');

const args = new Set(process.argv.slice(2));
const USE_GITHUB = args.has('--github');
const APPLY = args.has('--apply');
const MARKDOWN = args.has('--markdown');
const FAIL_ON_DRIFT = args.has('--fail-on-drift');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const CORIOLIS_SCREENS = [
  'aurora',
  'breathe',
  'clock',
  'exercise',
  'fireplace',
  'labyrinth',
  'launcher',
  'lava',
  'mandala',
  'snake',
  'weather',
  'yoga',
];

const REPOS = [
  {
    slug: 'path-of-leash-resistance',
    repo: 'cyanidesayonara/path-of-leash-resistance',
    localDir: path.resolve(REPO_ROOT, '..', 'path-of-leash-resistance'),
    assets: [],
  },
  {
    slug: 'stemma',
    repo: 'cyanidesayonara/stemma',
    localDir: path.resolve(REPO_ROOT, '..', 'stemma'),
    assets: [],
  },
  {
    slug: 'coriolis',
    repo: 'cyanidesayonara/coriolis',
    localDir: path.resolve(REPO_ROOT, '..', 'coriolis'),
    assets: [
      { src: 'web/build/coriolis.js', dest: 'public/coriolis/coriolis.js', optional: false },
      { src: 'web/build/coriolis.wasm', dest: 'public/coriolis/coriolis.wasm', optional: false },
      ...CORIOLIS_SCREENS.map((name) => ({
        src: `docs/screenshots/${name}.png`,
        dest: `public/img/projects/coriolis-${name}.png`,
        optional: false,
      })),
    ],
  },
  {
    slug: 'eat-prey-nap',
    repo: 'cyanidesayonara/eat-prey-nap',
    localDir: path.resolve(REPO_ROOT, '..', 'eat-prey-nap'),
    assets: [
      { src: 'shots/p0_s1_creep.png', dest: 'public/img/projects/eat-prey-nap-cover.png', optional: true },
      { src: 'shots/p1_s1_creep.png', dest: 'public/img/projects/eat-prey-nap-night.png', optional: true },
      { src: 'shots/start.png', dest: 'public/img/projects/eat-prey-nap-start.png', optional: true },
    ],
  },
  {
    slug: 'dopepod',
    repo: 'cyanidesayonara/dop3pod',
    localDir: path.resolve(REPO_ROOT, '..', 'dop3pod'),
    assets: [],
  },
];

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function readExistingMeta() {
  if (!fs.existsSync(META_PATH)) return { projects: {} };
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  } catch {
    return { projects: {} };
  }
}

function git(dir, gitArgs) {
  return execFileSync('git', ['-C', dir, ...gitArgs], { encoding: 'utf8' }).trim();
}

function tryGit(dir, gitArgs) {
  try {
    return git(dir, gitArgs);
  } catch {
    return '';
  }
}

function countBossRows(mdText) {
  let count = 0;
  for (const line of mdText.split(/\r?\n/)) {
    if (/^\|\s*\d+\s*\|/.test(line)) count++;
  }
  return count;
}

function countGdTestsLocal(dir) {
  const testsDir = path.join(dir, 'tests');
  if (!fs.existsSync(testsDir)) return 0;
  let count = 0;
  const stack = [testsDir];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.gd')) count++;
    }
  }
  return count;
}

async function ghFetchJson(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'santtu-fyi-sync',
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${url}`);
  }
  return { data: await res.json(), headers: res.headers };
}

async function ghFetchBytes(ownerRepo, branch, relPath) {
  const headers = { 'User-Agent': 'santtu-fyi-sync' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const url = `https://raw.githubusercontent.com/${ownerRepo}/${branch}/${relPath}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Raw fetch ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function inspectLocalRepo(spec, prevProjectMeta) {
  if (!fs.existsSync(path.join(spec.localDir, '.git'))) {
    return {
      meta: prevProjectMeta ?? { repo: spec.repo, defaultBranch: 'main', latestTag: null },
      assetReads: [],
      warning: `Local repository missing at ${spec.localDir}`,
    };
  }

  const originHead = tryGit(spec.localDir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  const currentBranch = tryGit(spec.localDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const defaultBranch = originHead ? originHead.replace(/^origin\//, '') : currentBranch || 'main';
  const tagsRaw = tryGit(spec.localDir, ['tag', '--sort=-creatordate']);
  const latestTag = tagsRaw
    ? tagsRaw.split(/\r?\n/).find((t) => /^v?\d+\.\d+/.test(t)) ?? null
    : null;
  const latestCommitSha = tryGit(spec.localDir, ['rev-parse', '--short', 'HEAD']) || null;
  const latestCommitDate = tryGit(spec.localDir, ['log', '-1', '--format=%cs', 'HEAD']) || null;

  const meta = {
    repo: spec.repo,
    defaultBranch,
    latestTag,
    latestCommitSha,
    latestCommitDate,
  };

  if (spec.slug === 'path-of-leash-resistance') {
    const walksPath = path.join(spec.localDir, 'site', 'walks.json');
    if (fs.existsSync(walksPath)) {
      const walksObj = JSON.parse(fs.readFileSync(walksPath, 'utf8'));
      const keys = Object.keys(walksObj);
      meta.walksTotal = keys.length;
      meta.mainWalks = keys.includes('tutorial') ? keys.length - 1 : keys.length;
    }
    const bossesPath = path.join(spec.localDir, 'docs', 'BOSSES.md');
    if (fs.existsSync(bossesPath)) {
      meta.bossCount = countBossRows(fs.readFileSync(bossesPath, 'utf8'));
    }
    const commitsStr = tryGit(spec.localDir, ['rev-list', '--count', 'HEAD']);
    if (commitsStr) meta.commits = Number(commitsStr);
    const mergesStr = tryGit(spec.localDir, ['log', '--merges', '--grep=Merge pull request', '--oneline']);
    if (mergesStr) meta.mergedPrs = mergesStr.split(/\r?\n/).filter(Boolean).length;
    meta.testFiles = countGdTestsLocal(spec.localDir);
  }

  const assetReads = [];
  for (const a of spec.assets) {
    const fullSrc = path.join(spec.localDir, a.src);
    if (!fs.existsSync(fullSrc)) {
      if (!a.optional) assetReads.push({ ...a, missing: true, buf: null });
      continue;
    }
    assetReads.push({ ...a, missing: false, buf: fs.readFileSync(fullSrc) });
  }

  return { meta, assetReads, warning: null };
}

async function inspectGithubRepo(spec, prevProjectMeta) {
  const { data: repoData } = await ghFetchJson(`https://api.github.com/repos/${spec.repo}`);
  const defaultBranch = repoData.default_branch || 'main';

  const { data: commitList, headers: commitHeaders } = await ghFetchJson(
    `https://api.github.com/repos/${spec.repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
  );
  const topCommit = commitList[0];
  const latestCommitSha = topCommit ? topCommit.sha.slice(0, 7) : null;
  const latestCommitDate = topCommit?.commit?.committer?.date?.slice(0, 10) ?? null;

  let latestTag = null;
  try {
    const { data: rel } = await ghFetchJson(`https://api.github.com/repos/${spec.repo}/releases/latest`);
    latestTag = rel?.tag_name ?? null;
  } catch {
    try {
      const { data: tags } = await ghFetchJson(`https://api.github.com/repos/${spec.repo}/tags?per_page=10`);
      latestTag = tags.find((t) => /^v?\d+\.\d+/.test(t.name))?.name ?? null;
    } catch {
      latestTag = null;
    }
  }

  const meta = {
    repo: spec.repo,
    defaultBranch,
    latestTag,
    latestCommitSha,
    latestCommitDate,
  };

  if (spec.slug === 'path-of-leash-resistance') {
    const linkHeader = commitHeaders.get('link') || '';
    const lastMatch = /[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(linkHeader);
    if (lastMatch) meta.commits = Number(lastMatch[1]);
    else if (prevProjectMeta?.commits) meta.commits = prevProjectMeta.commits;

    try {
      const { data: prSearch } = await ghFetchJson(
        `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${spec.repo} is:pr is:merged`)}&per_page=1`,
      );
      if (typeof prSearch.total_count === 'number') meta.mergedPrs = prSearch.total_count;
    } catch {
      if (prevProjectMeta?.mergedPrs) meta.mergedPrs = prevProjectMeta.mergedPrs;
    }

    const walksBuf = await ghFetchBytes(spec.repo, defaultBranch, 'site/walks.json');
    if (walksBuf) {
      const walksObj = JSON.parse(walksBuf.toString('utf8'));
      const keys = Object.keys(walksObj);
      meta.walksTotal = keys.length;
      meta.mainWalks = keys.includes('tutorial') ? keys.length - 1 : keys.length;
    }

    const bossesBuf = await ghFetchBytes(spec.repo, defaultBranch, 'docs/BOSSES.md');
    if (bossesBuf) {
      meta.bossCount = countBossRows(bossesBuf.toString('utf8'));
    }

    try {
      const { data: tree } = await ghFetchJson(
        `https://api.github.com/repos/${spec.repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      );
      meta.testFiles = (tree.tree || []).filter(
        (n) => n.type === 'blob' && n.path.startsWith('tests/') && n.path.endsWith('.gd'),
      ).length;
    } catch {
      if (prevProjectMeta?.testFiles) meta.testFiles = prevProjectMeta.testFiles;
    }
  }

  const assetReads = [];
  for (const a of spec.assets) {
    const buf = await ghFetchBytes(spec.repo, defaultBranch, a.src);
    if (!buf) {
      if (!a.optional) assetReads.push({ ...a, missing: true, buf: null });
      continue;
    }
    assetReads.push({ ...a, missing: false, buf });
  }

  return { meta, assetReads, warning: null };
}

async function main() {
  const existing = readExistingMeta();
  const nextProjects = {};
  const diffs = [];
  const assetChanges = [];
  const warnings = [];

  for (const spec of REPOS) {
    const prev = existing.projects?.[spec.slug];
    const inspected = USE_GITHUB
      ? await inspectGithubRepo(spec, prev)
      : await inspectLocalRepo(spec, prev);

    if (inspected.warning) warnings.push(`${spec.slug}: ${inspected.warning}`);
    nextProjects[spec.slug] = inspected.meta;

    const prevJson = JSON.stringify(prev ?? null);
    const nextJson = JSON.stringify(inspected.meta);
    if (prevJson !== nextJson) {
      diffs.push({ slug: spec.slug, prev, next: inspected.meta });
    }

    for (const asset of inspected.assetReads) {
      if (asset.missing) {
        warnings.push(`${spec.slug}: missing asset ${asset.src}`);
        continue;
      }
      const destFull = path.join(REPO_ROOT, asset.dest);
      const destExists = fs.existsSync(destFull);
      const destHash = destExists ? sha256(fs.readFileSync(destFull)) : null;
      const srcHash = sha256(asset.buf);
      if (destHash !== srcHash) {
        assetChanges.push({ slug: spec.slug, dest: asset.dest, existed: destExists });
        if (APPLY) {
          fs.mkdirSync(path.dirname(destFull), { recursive: true });
          fs.writeFileSync(destFull, asset.buf);
        }
      }
    }
  }

  const nextMeta = { projects: nextProjects };
  const nextMetaText = JSON.stringify(nextMeta, null, 2) + '\n';
  const prevMetaText = fs.existsSync(META_PATH) ? fs.readFileSync(META_PATH, 'utf8') : '';
  const metaChanged = nextMetaText !== prevMetaText;

  if (APPLY && metaChanged) {
    fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
    fs.writeFileSync(META_PATH, nextMetaText, 'utf8');
  }

  const hasDrift = diffs.length > 0 || assetChanges.length > 0 || metaChanged;

  if (MARKDOWN) {
    console.log('## Portfolio Project Sync Summary\n');
    console.log(`Mode: ${USE_GITHUB ? 'GitHub API' : 'Local sibling repositories'}${APPLY ? ' (applied)' : ' (check only)'}\n`);
    if (diffs.length > 0) {
      console.log('### Metadata changes');
      for (const d of diffs) {
        console.log(`- **${d.slug}**: latest commit \`${d.next.latestCommitSha}\` (${d.next.latestCommitDate}), tag \`${d.next.latestTag ?? 'none'}\``);
      }
      console.log('');
    }
    if (assetChanges.length > 0) {
      console.log('### Updated assets');
      for (const a of assetChanges) {
        console.log(`- \`${a.dest}\` (${a.existed ? 'updated' : 'added'} from \`${a.slug}\`)`);
      }
      console.log('');
    }
    if (!hasDrift) {
      console.log('Everything is already up to date.');
    }
    if (warnings.length > 0) {
      console.log('\n### Notes');
      for (const w of warnings) console.log(`- ${w}`);
    }
  } else {
    console.log(
      JSON.stringify(
        {
          mode: USE_GITHUB ? 'github' : 'local',
          applied: APPLY,
          hasDrift,
          metaChanged,
          metadataDiffs: diffs.map((d) => ({ slug: d.slug, next: d.next })),
          assetChanges,
          warnings,
        },
        null,
        2,
      ),
    );
  }

  if (FAIL_ON_DRIFT && hasDrift) {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
