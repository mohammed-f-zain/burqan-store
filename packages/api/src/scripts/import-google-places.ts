/**
 * Import grocery / supermarket listings from Google Places into google_map_places.
 *
 *   GOOGLE_MAPS_API_KEY=... npm run import:google-places -w @burqan/api
 *   GOOGLE_MAPS_API_KEY=... npm run import:google-places -w @burqan/api -- --governorate=عمان
 *   GOOGLE_MAPS_API_KEY=... npm run import:google-places -w @burqan/api -- --governorate=عمان --regenerate=1
 */
import { importGooglePlaces } from "../utils/importGooglePlaces.js";
import { pool } from "../db/pool.js";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`) || arg(name) === "1" || arg(name) === "true";
}

async function main() {
  const governorate = arg("governorate");
  const result = await importGooglePlaces({ governorate, regenerate: flag("regenerate") });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  await pool.end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
