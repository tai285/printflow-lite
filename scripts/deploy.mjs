// Pulls the newest published image, restarts the production stack and checks
// it came up healthy. If the new version fails, the last good one is restored.
//
//   npm run deploy                 newest image (the "latest" tag)
//   npm run deploy -- --check      only report whether an update exists (changes nothing)
//   npm run deploy -- <git-sha>    a specific build; use it to roll back
//   npm run deploy -- --auto       for the scheduled task: same as deploy, but it
//                                  will not retry a build that already failed
//
// Nothing is restarted when the newest image is already the one running.
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

const args = process.argv.slice(2)
const auto = args.includes('--auto')
const checkOnly = args.includes('--check')
const tag = args.find((arg) => !arg.startsWith('--')) ?? 'latest'
console.log(
  `[${new Date().toISOString()}] deploy tag=${tag}${auto ? ' (auto)' : ''}${checkOnly ? ' (check only)' : ''}`,
)
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

const writeState = (state) =>
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))

/** Output of a docker command, or undefined if it fails. */
function docker(args, imageTag = tag) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, PF_TAG: imageTag },
    }).trim()
  } catch {
    return undefined
  }
}

/** The app image for a tag, as written in compose.prod.yaml. */
function appImageName() {
  const images = docker([...compose, 'config', '--images']) ?? ''
  return images
    .split('\n')
    .find((image) => image && !/^(postgres|cloudflare)/.test(image))
}

/** ID of the image the running app container was started from. */
function runningImageId() {
  const container = docker([...compose, 'ps', '-q', 'app'])
  return container
    ? docker(['inspect', '-f', '{{.Image}}', container])
    : undefined
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

const state = readState()
const previous = state.lastGood

console.log(`Looking for image tag "${tag}"…`)
let ok = true
if (!process.env.SKIP_PULL) ok = run(['pull', 'app'], tag)

// Compare what we just pulled with what is running, before touching anything.
const image = appImageName()
const newId = image
  ? docker(['image', 'inspect', '-f', '{{.Id}}', image])
  : undefined
const currentVersion = runningVersion()
if (ok && newId && newId === runningImageId() && currentVersion) {
  console.log(`Already up to date (build ${currentVersion}). Nothing to do.`)
  process.exit(0)
}
if (checkOnly) {
  console.log(
    ok
      ? `An update is available (running ${currentVersion ?? 'nothing'}). Run "npm run deploy" to apply it.`
      : 'Could not fetch the image; see the messages above.',
  )
  process.exit(ok ? 0 : 1)
}
if (auto && newId && state.failedImage === newId) {
  console.log(
    'This build already failed to start here; skipping until a newer one is published.',
  )
  process.exit(0)
}

console.log(`Deploying image tag "${tag}"…`)
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
  // Remember the bad image so the scheduled task does not retry it every run.
  writeState({ ...state, failedImage: newId })
  process.exit(1)
}

writeState({ lastGood: version })
console.log(`\nDeployed build ${version}.`)
printPublicUrl()
