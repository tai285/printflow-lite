// Pulls the newest published image, restarts the production stack and checks
// it came up healthy. If the new version fails, the last good one is restored.
//
//   npm run deploy                 newest image (the "latest" tag)
//   npm run deploy -- <git-sha>    a specific build; use it to roll back
//
// Needs .env.production (see .env.production.example). SKIP_PULL=1 uses images
// already on this machine (for testing with a locally built image).
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'

const ENV_FILE = '.env.production'
const STATE_FILE = '.deploy-state.json' // git-ignored; remembers the last good build
const compose = ['compose', '--env-file', ENV_FILE, '-f', 'compose.prod.yaml']

if (!fs.existsSync(ENV_FILE)) {
  console.error(
    `Missing ${ENV_FILE}. Copy .env.production.example and fill it in.`,
  )
  process.exit(1)
}

const tag = process.argv[2] ?? 'latest'
if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(tag)) {
  console.error(`"${tag}" is not a valid image tag`)
  process.exit(1)
}

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

/** Runs docker compose with the given image tag; returns true on success. */
function run(args, imageTag) {
  const result = spawnSync('docker', [...compose, ...args], {
    stdio: 'inherit',
    env: { ...process.env, PF_TAG: imageTag },
  })
  return result.status === 0
}

/** The build version the running app reports on /api/health, or undefined. */
function runningVersion() {
  try {
    const out = execFileSync(
      'docker',
      [
        ...compose,
        'exec',
        '-T',
        'app',
        'node',
        '-e',
        "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>console.log(j.version))",
      ],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return out.trim() || undefined
  } catch {
    return undefined
  }
}

function printPublicUrl() {
  try {
    const logs = execFileSync(
      'docker',
      [...compose, 'logs', 'tunnel-quick', '--no-color'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const urls = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)
    if (urls) console.log(`Public address: ${urls[urls.length - 1]}`)
  } catch {
    // No quick tunnel in use (named tunnel, or none yet).
  }
}

const previous = readState().lastGood

console.log(`Deploying image tag "${tag}"…`)
let ok = true
if (!process.env.SKIP_PULL) ok = run(['pull', 'app'], tag)
// `--wait` returns only when every service is healthy (the image has a health check).
ok =
  ok &&
  run(['up', '-d', '--wait', '--wait-timeout', '120', '--remove-orphans'], tag)

const version = ok ? runningVersion() : undefined
// A specific tag must report that same build; "latest" can be any build.
const versionMatches = tag === 'latest' || version === tag
if (!ok || !version || !versionMatches) {
  console.error(
    `\nDeploy of "${tag}" failed${version ? ` (app reports ${version})` : ''}.`,
  )
  if (previous && previous !== tag) {
    console.error(`Restoring the last good build ${previous}…`)
    const restored = run(
      ['up', '-d', '--wait', '--wait-timeout', '120'],
      previous,
    )
    console.error(
      restored
        ? 'Rolled back.'
        : 'Rollback failed too: check `docker compose logs`.',
    )
  } else {
    console.error('No earlier good build is recorded to roll back to.')
  }
  process.exit(1)
}

fs.writeFileSync(STATE_FILE, JSON.stringify({ lastGood: version }, null, 2))
console.log(`\nDeployed build ${version}.`)
printPublicUrl()
