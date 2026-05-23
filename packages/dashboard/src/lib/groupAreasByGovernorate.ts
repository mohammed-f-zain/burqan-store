export type AreaWithGovernorate = {
  id: number;
  name: string;
  governorate?: string | null;
};

export type AreaGovernorateGroup<T extends AreaWithGovernorate> = {
  key: string;
  label: string;
  areas: T[];
};

const GOVERNORATE_PRIORITY = [
  "عمان",
  "الزرقاء",
  "إربد",
  "البلقاء",
  "مادبا",
  "المفرق",
  "العقبة",
  "الكرك",
  "معان",
  "الطفيلة",
  "جرش",
  "عجلون",
] as const;

function governorateSortKey(name: string): number {
  const i = GOVERNORATE_PRIORITY.indexOf(name as (typeof GOVERNORATE_PRIORITY)[number]);
  return i >= 0 ? i : 100 + name.charCodeAt(0);
}

/** Group areas under governorate labels for accordion UI. */
export function groupAreasByGovernorate<T extends AreaWithGovernorate>(
  areas: T[],
  unassignedLabel: string
): AreaGovernorateGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const a of areas) {
    const gov = a.governorate?.trim() ?? "";
    if (!map.has(gov)) map.set(gov, []);
    map.get(gov)!.push(a);
  }

  for (const list of map.values()) {
    list.sort((x, y) => x.name.localeCompare(y.name, "ar"));
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    const pa = governorateSortKey(a);
    const pb = governorateSortKey(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "ar");
  });

  return keys.map((gov) => ({
    key: gov || "__unassigned",
    label: gov || unassignedLabel,
    areas: map.get(gov)!,
  }));
}
