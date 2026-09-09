import { config } from 'dotenv'
import { createDevServer } from './app.js'

config({ quiet: true })
const enabled =
  process.argv.includes('--dev') && process.env.NODE_ENV !== 'production'
if (!enabled) {
  console.error('Servidor de teste desativado fora do desenvolvimento.')
  process.exitCode = 1
} else {
  const server = createDevServer(true)
  server.on('error', () => {
    console.error('Não foi possível iniciar o servidor local na porta 3001.')
    process.exitCode = 1
  })
  server.listen(3001, '127.0.0.1', () => {
    console.info('Teste local: http://127.0.0.1:3001/api/dev/instagram/test')
  })
}
