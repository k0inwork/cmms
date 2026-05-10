import jwt, { type SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || ACCESS_SECRET + "-refresh";
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || "7d";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export function signAccessToken(payload: TokenPayload): string {
  const opts: SignOptions = { expiresIn: ACCESS_EXPIRY as any };
  return jwt.sign(payload, ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: TokenPayload): string {
  const opts: SignOptions = { expiresIn: REFRESH_EXPIRY as any };
  return jwt.sign(payload, REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}
