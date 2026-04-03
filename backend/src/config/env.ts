import path from "path";
import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const resolvedUploadDir = process.env.UPLOAD_DIR?.trim()
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR.trim())
  : path.resolve(process.cwd(), "uploads");

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtSecret: process.env.JWT_SECRET?.trim() || "change-me",
  corsOrigin: process.env.CORS_ORIGIN?.trim() || "*",
  uploadDir: resolvedUploadDir,
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || "",
  pointToMoneyRate: Number(process.env.POINT_TO_MONEY_RATE || 0.25),
  adminName: process.env.ADMIN_NAME?.trim() || "Civic Samadhan Admin",
  adminEmail: process.env.ADMIN_EMAIL?.trim() || "",
  adminPassword: process.env.ADMIN_PASSWORD?.trim() || "",
  /** OAuth 2.0 Web client ID used to verify Google ID tokens */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
} as const;

if (!Number.isFinite(env.port) || env.port <= 0) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

if (!Number.isFinite(env.pointToMoneyRate) || env.pointToMoneyRate < 0) {
  throw new Error(`Invalid POINT_TO_MONEY_RATE value: ${process.env.POINT_TO_MONEY_RATE}`);
}
