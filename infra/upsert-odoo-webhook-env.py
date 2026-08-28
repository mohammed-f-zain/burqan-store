#!/usr/bin/env python3
"""Upsert Odoo webhook keys into packages/api/.env. Reads ODOO_WEBHOOK_SECRET from the environment. Never prints the secret."""

from __future__ import annotations

import os
import pathlib
import re
import sys

SECRET = os.environ.get("ODOO_WEBHOOK_SECRET", "").strip()
if not SECRET:
    print("ODOO_WEBHOOK_SECRET is empty", file=sys.stderr)
    sys.exit(1)

path = pathlib.Path("packages/api/.env")
text = path.read_text() if path.exists() else ""
updates = {
    "ODOO_WEBHOOK_URL": "https://erp.burqan.tech/burqan/webhook/sale",
    "ODOO_WEBHOOK_SECRET": SECRET,
}
for key, value in updates.items():
    line = f"{key}={value}"
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    if pattern.search(text):
        text = pattern.sub(lambda _m, l=line: l, text)
    else:
        if text and not text.endswith("\n"):
            text += "\n"
        text += line + "\n"
path.write_text(text)
print("Odoo webhook env upserted in packages/api/.env")
