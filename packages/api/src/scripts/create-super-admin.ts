/**
 * Create or update a super admin (production-safe via env, never commit passwords).
 *
 * SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD='...' SUPER_ADMIN_NAME='Name' npm run create-super-admin
 */
import { hashPassword } from "../utils/password.js";
import { query, pool } from "../db/pool.js";

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_NAME?.trim() || "Super Admin";
  if (!email || !password || password.length < 10) {
    // eslint-disable-next-line no-console
    console.error("Set SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (min 10), optional SUPER_ADMIN_NAME");
    process.exit(1);
  }

  const ph = await hashPassword(password);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO admins (email, password_hash, full_name, is_super_admin, role_id, created_by_admin_id, is_active)
     VALUES ($1, $2, $3, true, NULL, NULL, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       is_super_admin = true,
       role_id = NULL,
       is_active = true
     RETURNING id`,
    [email, ph, fullName]
  );
  // eslint-disable-next-line no-console
  console.log(`Super admin ready: #${rows[0]!.id} (${email})`);
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
