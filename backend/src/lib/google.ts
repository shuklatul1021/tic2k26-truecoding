import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";

let cachedClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!cachedClient) {
    cachedClient = new OAuth2Client(env.googleClientId);
  }
  return cachedClient;
}

export interface GoogleProfile {
  email: string;
  name: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await getOAuthClient().verifyIdToken({
    idToken,
    audience: env.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Invalid Google token: missing email");
  }

  if (payload.email_verified === false) {
    throw new Error("Google account email is not verified");
  }

  const email = payload.email.trim().toLowerCase();
  const name =
    (typeof payload.name === "string" && payload.name.trim()) || email.split("@")[0] || "User";

  return { email, name };
}
