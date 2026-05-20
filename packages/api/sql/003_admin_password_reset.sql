CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  admin_id INT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_reset_token_hash ON admin_password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_reset_admin ON admin_password_reset_tokens(admin_id);
