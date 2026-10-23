// Prints the current public URL of the Cloudflare quick tunnel.
//   npm run public:url
import { execFileSync } from 'node:child_process'

const compose = ['compose', '-f', 'compose.yaml', '-f', 'compose.public.yaml']
const waitSeconds = Number(process.env.WAIT_SECONDS ?? 60)
const deadline = Date.now() + waitSeconds * 1000

while (Date.now() < deadline) {
  let logs = ''
  try {
    logs = execFileSync(
      'docker',
      [...compose, 'logs', 'tunnel', '--no-color'],
      {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch {
    // The tunnel container may not exist yet; keep waiting.
  }
  const urls = logs.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)
  if (urls) {
    console.log(urls[urls.length - 1])
    process.exit(0)
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
console.error(
  `No tunnel URL found within ${waitSeconds}s. Check: docker compose -f compose.yaml -f compose.public.yaml logs tunnel`,
)
process.exit(1)
