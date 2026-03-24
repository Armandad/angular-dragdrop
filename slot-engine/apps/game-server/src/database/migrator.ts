import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Simple database migration runner.
 * Executes SQL migration files in order, tracking applied migrations.
 *
 * Migration files should be named: 001_initial_schema.sql, 002_add_index.sql, etc.
 */
export class Migrator {
  private pool: PgPoolLike | null = null;
  private migrationsDir: string;

  constructor(databaseUrl?: string, migrationsDir?: string) {
    this.migrationsDir =
      migrationsDir ??
      resolve(fileURLToPath(import.meta.url), '..', 'migrations');

    const url = databaseUrl ?? process.env['DATABASE_URL'];
    if (url) {
      this.connect(url).catch((err) => {
        console.warn('Migrator: Failed to connect:', err);
      });
    }
  }

  private async connect(url: string): Promise<void> {
    try {
      const pg = await import('pg') as { Pool: new (config: { connectionString: string }) => PgPoolLike };
      this.pool = new pg.Pool({ connectionString: url });
    } catch {
      console.warn('Migrator: pg module not available');
    }
  }

  async migrate(): Promise<string[]> {
    if (!this.pool) {
      console.warn('Migrator: no database connection, skipping migrations');
      return [];
    }

    // Ensure migrations table exists
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const result = await this.pool.query('SELECT name FROM _migrations ORDER BY id');
    const applied = new Set((result.rows as { name: string }[]).map((r) => r.name));

    // Read migration files
    let files: string[];
    try {
      files = await readdir(this.migrationsDir);
    } catch {
      console.warn(`Migrator: migrations directory not found: ${this.migrationsDir}`);
      return [];
    }

    const sqlFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const newlyApplied: string[] = [];

    for (const file of sqlFiles) {
      if (applied.has(file)) continue;

      console.log(`Migrating: ${file}`);
      const sql = await readFile(join(this.migrationsDir, file), 'utf-8');

      try {
        await this.pool.query('BEGIN');
        await this.pool.query(sql);
        await this.pool.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file],
        );
        await this.pool.query('COMMIT');
        newlyApplied.push(file);
        console.log(`  Applied: ${file}`);
      } catch (err) {
        await this.pool.query('ROLLBACK');
        console.error(`  Failed: ${file}`, err);
        throw err;
      }
    }

    if (newlyApplied.length === 0) {
      console.log('Migrator: all migrations up to date');
    } else {
      console.log(`Migrator: applied ${newlyApplied.length} migration(s)`);
    }

    return newlyApplied;
  }

  async rollback(count = 1): Promise<string[]> {
    if (!this.pool) return [];

    const result = await this.pool.query(
      'SELECT name FROM _migrations ORDER BY id DESC LIMIT $1',
      [count],
    );

    const rolledBack: string[] = [];

    for (const row of result.rows as { name: string }[]) {
      await this.pool.query('DELETE FROM _migrations WHERE name = $1', [row.name]);
      rolledBack.push(row.name);
      console.log(`Rolled back: ${row.name}`);
    }

    return rolledBack;
  }

  async status(): Promise<Array<{ name: string; applied_at: string }>> {
    if (!this.pool) return [];

    const result = await this.pool.query(
      'SELECT name, applied_at FROM _migrations ORDER BY id',
    );
    return result.rows as Array<{ name: string; applied_at: string }>;
  }

  async destroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

interface PgPoolLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}
