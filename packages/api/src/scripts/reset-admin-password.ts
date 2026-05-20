/**
 * Reset an admin password (bcrypt hash in DB).
 *
 * Usage (from repo root):
 *   ADMIN_EMAIL=super@burqan.store ADMIN_PASSWORD='YourNewSecurePass1!' npm run api:reset-admin
 *
 * On the VPS (after git pull), same command with packages/api/.env pointing at production DB.
 */
import { hashPassword } from "../utils/password.js";
import { query, pool } from "../db/pool.js";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    // eslint-disable-next-line no-console
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 10 characters).");
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const { rows } = await query<{ id: number; email: string }>(
    `UPDATE admins SET password_hash = $1 WHERE lower(email) = lower($2) AND is_active = true
     RETURNING id, email`,
    [hash, email]
  );
  if (!rows[0]) {
    // eslint-disable-next-line no-console
    console.error(`No active admin found for email: ${email}`);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`Password updated for admin #${rows[0].id} (${rows[0].email})`);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
