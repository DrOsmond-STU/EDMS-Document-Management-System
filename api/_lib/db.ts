import { Pool, type PoolClient } from 'pg'
import { initialState, reducer, type Action, type SharedState } from '../../src/state/reducer'

const ROW_ID = 1

let pool: Pool | null = null

function getPool(): Pool {
  if (pool) return pool
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('Database belum tersambung. Hubungkan Postgres di Vercel > Storage lalu redeploy.')
  }
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  return pool
}

async function ensureSchema(runner: Pool | PoolClient): Promise<void> {
  await runner.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
}

export async function readState(): Promise<SharedState> {
  const db = getPool()
  await ensureSchema(db)
  const { rows } = await db.query('SELECT state FROM app_state WHERE id = $1', [ROW_ID])
  if (rows.length > 0) return rows[0].state as SharedState

  const seed = initialState()
  await db.query('INSERT INTO app_state (id, state) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [
    ROW_ID,
    JSON.stringify(seed),
  ])
  const again = await db.query('SELECT state FROM app_state WHERE id = $1', [ROW_ID])
  return again.rows[0].state as SharedState
}

export async function applyAction(action: Action): Promise<SharedState> {
  const db = getPool()
  await ensureSchema(db)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    let { rows } = await client.query('SELECT state FROM app_state WHERE id = $1 FOR UPDATE', [ROW_ID])
    if (rows.length === 0) {
      const seed = initialState()
      await client.query(
        'INSERT INTO app_state (id, state) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING',
        [ROW_ID, JSON.stringify(seed)],
      )
      const again = await client.query('SELECT state FROM app_state WHERE id = $1 FOR UPDATE', [ROW_ID])
      rows = again.rows
    }
    const current = rows[0].state as SharedState
    const next = reducer(current, action)
    await client.query('UPDATE app_state SET state = $1::jsonb, updated_at = now() WHERE id = $2', [
      JSON.stringify(next),
      ROW_ID,
    ])
    await client.query('COMMIT')
    return next
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
