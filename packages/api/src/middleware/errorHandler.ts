import multer from "multer";

import { HttpError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "غير موجود" });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "حجم الصورة كبير جداً (الحد 8 ميجابايت)" });
    }
    return res.status(400).json({ error: "فشل رفع الملف" });
  }
  if (err instanceof Error && err.message === "INVALID_IMAGE_TYPE") {
    return res.status(400).json({ error: "يُسمح فقط بصور JPEG أو PNG أو GIF أو WebP" });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "خطأ داخلي في الخادم" });
};
