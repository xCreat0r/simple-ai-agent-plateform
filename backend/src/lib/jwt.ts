import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET 环境变量未设置");
const SECRET = new TextEncoder().encode(secret);
const ACCESS_EXPIRES_IN = "15m";
const ISS = "agent-platform";

export interface AccessTokenPayload {
  userId: string;
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISS)
    .setExpirationTime(ACCESS_EXPIRES_IN)
    .sign(SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET, { issuer: ISS });
  return { userId: payload.userId as string };
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
