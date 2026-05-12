import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { config } from "../config.js";

fs.mkdirSync(config.uploadDir, { recursive: true });

const allowedExt = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, config.uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safe = allowedExt.has(ext) ? ext : ".jpg";
      cb(null, `${randomBytes(18).toString("hex")}${safe}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|jpg|pjpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(new Error("INVALID_IMAGE_TYPE"));
      return;
    }
    cb(null, true);
  },
});
