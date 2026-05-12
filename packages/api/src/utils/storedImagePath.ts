import { z } from "zod";

/** Values stored in DB: relative path served under /uploads/... */
export const storedImagePathSchema = z
  .string()
  .regex(/^\/uploads\/[a-zA-Z0-9._-]+$/, "INVALID_IMAGE_PATH");

export const optionalStoredImagePathSchema = z.preprocess(
  (v) => (v === "" || v === null || typeof v === "undefined" ? undefined : v),
  storedImagePathSchema.optional()
);

export const optionalStoredImagePathNullableSchema = z.preprocess(
  (v) => (v === "" ? null : v === null || typeof v === "undefined" ? undefined : v),
  z.union([storedImagePathSchema, z.null()]).optional()
);
