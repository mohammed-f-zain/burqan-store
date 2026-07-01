---
name: fill-car
description: >-
  Fill car (van inventory) dashboard feature in burqan-store. Use when the user
  mentions /fill-car, fill car page, van inventory, rep daily sales, or sold/added
  quantity badges on product cards.
---

# Fill car (`/fill-car`)

Admin dashboard page for daily rep sales and van inventory.

## Key files

| Area | Path |
|------|------|
| Page | `packages/dashboard/src/pages/FillCarPage.tsx` |
| Styles | `packages/dashboard/src/styles.css` (`.fill-car-*`) |
| i18n | `packages/dashboard/src/i18n/en.ts` / `ar.ts` → `fillCar` |
| API | `packages/api/src/routes/admin.ts` |

## API

- `GET /representatives/sales-daily?date=YYYY-MM-DD` — all reps, order count, total sales, `lines[]` per product sold since each rep’s last van fill on that calendar day (Asia/Amman).
- `GET /representatives/:id/inventory` — products with `quantity` on car.
- `PUT /representatives/:id/inventory` — `{ items: [{ productId, quantity }] }`. If any quantity increases vs DB, sets `representatives.car_fill_at = now()` and returns `{ salesReset: true }` so fill-car sales counters restart.

Permissions: `fill_car.read` / `fill_car.write` (or `reps.read` / `reps.write`).

## Product card deltas

On each van inventory card show:

- **Red `-N`** — units **sold** not yet refilled: `max(0, soldToday − addedQty)` per product. Hides when edit quantity covers today’s sales for that product.
- **Green `+N`** — units **added** vs loaded baseline when admin increases quantity in the input.

Track `baselineQty` when inventory loads; compare `row.quantity - baselineQty[product_id]` for the green badge.

Use classes `fill-car-delta`, `fill-car-delta--sold`, `fill-car-delta--added`.

## UX notes

- Date picker filters sales by Jordan calendar day.
- Click a rep row to load their inventory section below.
- Saving inventory updates DB only; refresh baseline after successful save.
