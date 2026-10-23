import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
// The Docker build passes the git commit as GIT_SHA; plain local runs report "dev".
const version = process.env.GIT_SHA ?? 'dev'

createApp({ version }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
