import { createApp } from './app.ts'

const port = Number(process.env.PORT ?? 3000)
// Render sets RENDER_GIT_COMMIT on deploy; locally we report "dev".
const version = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_SHA ?? 'dev'

createApp({ version }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
