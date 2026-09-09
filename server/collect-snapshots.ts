import dotenv from 'dotenv'
import { collectSnapshots } from './snapshots.js'

dotenv.config({ quiet: true })
try {
  const result = await collectSnapshots()
  console.log(result.body)
  if (result.httpStatus !== 200) process.exitCode = 1
} catch {
  console.error('Coleta indisponível; nenhum detalhe sensível foi registrado.')
  process.exitCode = 1
}
