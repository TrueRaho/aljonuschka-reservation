import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Pool } = pg

// Simple .env parser
const envPath = path.join(__dirname, '..', '.env')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
  }
})

const pool = new Pool({
  connectionString: envVars.DATABASE_URL
})

const migrationSQL = fs.readFileSync(
  path.join(__dirname, '../prisma/migrations/20260207174609_add_customer_strikes/migration.sql'),
  'utf-8'
)

async function runMigration() {
  try {
    await pool.query(migrationSQL)
    console.log('✅ Migration completed successfully')

    // Record migration in _prisma_migrations table
    await pool.query(`
      INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES ($1, $2, NOW(), $3, $4, NULL, NOW(), 1)
    `, [
      crypto.randomUUID(),
      '',
      '20260207174609_add_customer_strikes',
      ''
    ])
    console.log('✅ Migration recorded in _prisma_migrations')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
