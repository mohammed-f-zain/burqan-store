import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

import { config } from "../config.js";

export type AdminJwtPayload = {
  sub: number;
  typ: "admin";
};

export type RepJwtPayload = {
  sub: number;
  typ: "rep";
};

export function signAdminToken(adminId: number): string {
  const payload: AdminJwtPayload = { sub: adminId, typ: "admin" };
  return jwt.sign(payload, config.jwtAdminSecret as Secret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

export function signRepToken(repId: number): string {
  const payload: RepJwtPayload = { sub: repId, typ: "rep" };
  return jwt.sign(payload, config.jwtRepSecret as Secret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  return jwt.verify(token, config.jwtAdminSecret as Secret) as unknown as AdminJwtPayload;
}

export function verifyRepToken(token: string): RepJwtPayload {
  return jwt.verify(token, config.jwtRepSecret as Secret) as unknown as RepJwtPayload;
}
