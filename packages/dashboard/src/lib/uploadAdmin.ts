export async function uploadAdminImage(file: File): Promise<string> {
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const token = localStorage.getItem("burqan_admin_token");
  if (!token) throw new Error("يجب تسجيل الدخول أولاً");
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${base}/api/v1/admin/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "فشل رفع الصورة");
  if (!data.path) throw new Error("لم يُرجع الخادم مسار الملف");
  return data.path;
}
