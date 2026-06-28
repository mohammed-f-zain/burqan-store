import { fetchJson } from "./fetchJson";

export type ResolvedRepArea = {
  areaId: number;
  areaName: string;
  assignedToRep: boolean;
};

/** Resolve sales area from GPS (used when registering or refreshing store location). */
export async function resolveRepArea(
  apiBase: string,
  headers: Record<string, string>,
  lat: number,
  lng: number
): Promise<ResolvedRepArea> {
  const { res, data } = await fetchJson<{
    areaId?: number;
    areaName?: string;
    governorate?: string | null;
    assignedToRep?: boolean;
    error?: string;
  }>(`${apiBase}/api/v1/rep/areas/resolve?lat=${lat}&lng=${lng}&forRegister=1`, {
    headers,
    timeoutMs: 20_000,
  });
  if (!res.ok || !data.areaId) {
    throw new Error(typeof data.error === "string" ? data.error : "تعذّر تحديد المنطقة من الموقع");
  }
  const gov = typeof data.governorate === "string" ? data.governorate : "";
  const nm = data.areaName ?? "";
  return {
    areaId: data.areaId,
    areaName: gov && nm ? `${nm} · ${gov}` : nm,
    assignedToRep: data.assignedToRep !== false,
  };
}
