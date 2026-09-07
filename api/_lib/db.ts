import { Pool, type PoolClient } from 'pg'
import { initialState, reducer, type Action, type SharedState } from '../../src/state/reducer'
import { hashPassword } from './password'
import { GAP_FOLLOWUPS } from '../../src/data/seed'

const ROW_ID = 1

// Prototype default — documented in the login screen and README. Any user
// seeded (or already live) without a passwordHash is lazily migrated to this
// on next read, so existing demo data never gets locked out. Sysadmins
// should have everyone set a real password afterward (User Management ->
// Reset Password, or the "Ganti Password" self-service action).
export const DEFAULT_PASSWORD = 'Edms#2026'

/** Ensures every user has a passwordHash, hashing DEFAULT_PASSWORD for any
 * that don't (covers both a fresh seed and an existing database predating
 * this feature). Returns [state, changed]. */
function migratePasswords(state: SharedState): [SharedState, boolean] {
  let changed = false
  const users = state.users.map((u) => {
    if (u.passwordHash) return u
    changed = true
    return { ...u, passwordHash: hashPassword(DEFAULT_PASSWORD) }
  })
  return changed ? [{ ...state, users }, true] : [state, false]
}

/** Backfills state.gapFollowUps for a database predating the Compliance
 * Matrix follow-up feature (that key won't exist in an older stored row).
 * Seeded with the same demo entries as a fresh install, not an empty array,
 * so the feature is visibly working on an old install without manual entry.
 * Returns [state, changed]. */
function migrateGapFollowUps(state: SharedState): [SharedState, boolean] {
  if (Array.isArray(state.gapFollowUps)) return [state, false]
  return [{ ...state, gapFollowUps: GAP_FOLLOWUPS }, true]
}

/** Strips passwordHash before a state ever reaches the browser. */
export function sanitizeForClient(state: SharedState): SharedState {
  return { ...state, users: state.users.map(({ passwordHash: _passwordHash, ...u }) => u) }
}

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
  let state: SharedState
  if (rows.length > 0) {
    state = rows[0].state as SharedState
  } else {
    const seed = initialState()
    await db.query('INSERT INTO app_state (id, state) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [
      ROW_ID,
      JSON.stringify(seed),
    ])
    const again = await db.query('SELECT state FROM app_state WHERE id = $1', [ROW_ID])
    state = again.rows[0].state as SharedState
  }
  const [migratedPw, changedPw] = migratePasswords(state)
  const [migrated, changedGf] = migrateGapFollowUps(migratedPw)
  if (changedPw || changedGf) {
    await db.query('UPDATE app_state SET state = $1::jsonb, updated_at = now() WHERE id = $2', [
      JSON.stringify(migrated),
      ROW_ID,
    ])
  }
  return migrated
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
    const [currentPw] = migratePasswords(rows[0].state as SharedState)
    const [current] = migrateGapFollowUps(currentPw)
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
