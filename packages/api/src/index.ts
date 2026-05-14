import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";

const app = createApp();

app.listen(config.port, config.listenHost, () => {
  // eslint-disable-next-line no-console
  console.log(
    `API listening on http://${config.listenHost}:${config.port} (mobile: use this machine's LAN IP + port in EXPO_PUBLIC_API_URL)`
  );
});

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
