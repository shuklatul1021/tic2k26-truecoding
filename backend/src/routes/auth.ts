import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { getUserStats } from "../db/queries.js";
import { env } from "../config/env.js";
import { verifyGoogleIdToken } from "../lib/google.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

async function registerUser(
  name: string,
  email: string,
  password: string,
  role: "user" | "admin" | "worker",
) {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new Error("Account already exists with this email");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING
       id,
       name,
       email,
       role,
       points_balance AS "pointsBalance",
       wallet_balance AS "walletBalance",
       created_at AS "createdAt"`,
    [name, email, passwordHash, role],
  );

  return rows[0] as {
    id: number;
    name: string;
    email: string;
    role: "user" | "admin" | "worker";
    pointsBalance: number;
    walletBalance: number;
    createdAt: string;
  };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "BadRequest", message: "Name, email and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "BadRequest", message: "Password must be at least 6 characters" });
      return;
    }

    const user = await registerUser(name.trim(), email.trim().toLowerCase(), password, "user");
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      token,
      user: {
        ...user,
        issuesReported: 0,
        issuesResolved: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    const status = message.includes("already exists") ? 409 : 500;
    if (status === 500) {
      logger.error({ error }, "Registration error");
    }
    res.status(status).json({
      error: status === 409 ? "Conflict" : "InternalError",
      message,
    });
  }
});

router.post("/register-admin", async (req, res) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: "BadRequest", message: "Name, email and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "BadRequest", message: "Password must be at least 6 characters" });
      return;
    }

    const user = await registerUser(name.trim(), email.trim().toLowerCase(), password, "admin");
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.status(201).json({
      token,
      user: {
        ...user,
        issuesReported: 0,
        issuesResolved: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin registration failed";
    const status = message.includes("already exists") ? 409 : 500;
    if (status === 500) {
      logger.error({ error }, "Admin registration error");
    }
    res.status(status).json({
      error: status === 409 ? "Conflict" : "InternalError",
      message,
    });
  }
});

router.post("/worker-login", async (req, res) => {
  try {
    const { email, aadhaarNumber } = req.body as {
      email?: string;
      aadhaarNumber?: string;
    };

    if (!email?.trim() || !aadhaarNumber?.trim()) {
      res.status(400).json({
        error: "BadRequest",
        message: "Email and Aadhaar number are required",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAadhaar = aadhaarNumber.replace(/\s+/g, "");

    const existingWorker = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.points_balance AS "pointsBalance",
         u.wallet_balance AS "walletBalance",
         u.created_at AS "createdAt",
         wp.onboarding_completed AS "onboardingCompleted"
       FROM users u
       INNER JOIN worker_profiles wp ON wp.user_id = u.id
       WHERE u.email = $1 AND wp.aadhaar_number = $2
       LIMIT 1`,
      [normalizedEmail, normalizedAadhaar],
    );

    const worker = existingWorker.rows[0] as
      | {
          id: number;
          name: string;
          email: string;
          role: "worker";
          pointsBalance: number;
          walletBalance: number;
          createdAt: string;
          onboardingCompleted: boolean;
        }
      | undefined;

    if (!worker) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Worker account not found. Create an account first.",
      });
      return;
    }

    const stats = await getUserStats(worker.id);
    const token = signToken({ userId: worker.id, email: worker.email, role: "worker" });

    res.json({
      token,
      user: {
        id: worker.id,
        name: worker.name,
        email: worker.email,
        role: "worker",
        pointsBalance: worker.pointsBalance,
        walletBalance: worker.walletBalance,
        onboardingCompleted: worker.onboardingCompleted,
        createdAt: worker.createdAt,
        issuesReported: stats.issuesReported,
        issuesResolved: stats.issuesResolved,
      },
    });
  } catch (error) {
    logger.error({ error }, "Worker login error");
    res.status(500).json({ error: "InternalError", message: "Worker login failed" });
  }
});

router.post("/worker-register", async (req, res) => {
  try {
    const { name, email, aadhaarNumber } = req.body as {
      name?: string;
      email?: string;
      aadhaarNumber?: string;
    };

    if (!name?.trim() || !email?.trim() || !aadhaarNumber?.trim()) {
      res.status(400).json({
        error: "BadRequest",
        message: "Name, email and Aadhaar number are required",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedAadhaar = aadhaarNumber.replace(/\s+/g, "");

    const registered = await registerUser(name.trim(), normalizedEmail, normalizedAadhaar, "worker");
    await pool.query(
      `INSERT INTO worker_profiles (user_id, aadhaar_number)
       VALUES ($1, $2)`,
      [registered.id, normalizedAadhaar],
    );

    const token = signToken({ userId: registered.id, email: registered.email, role: "worker" });

    res.status(201).json({
      token,
      user: {
        ...registered,
        role: "worker",
        onboardingCompleted: false,
        issuesReported: 0,
        issuesResolved: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker registration failed";
    const status = message.includes("already exists") ? 409 : 500;
    if (status === 500) {
      logger.error({ error }, "Worker registration error");
    }
    res.status(status).json({
      error: status === 409 ? "Conflict" : "InternalError",
      message,
    });
  }
});

router.post("/google", async (req, res) => {
  try {
    if (!env.googleClientId) {
      res.status(503).json({
        error: "NotConfigured",
        message: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID on the server.",
      });
      return;
    }

    const { idToken } = req.body as { idToken?: string };
    if (!idToken?.trim()) {
      res.status(400).json({ error: "BadRequest", message: "idToken is required" });
      return;
    }

    const profile = await verifyGoogleIdToken(idToken.trim());

    const existing = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         points_balance AS "pointsBalance",
         wallet_balance AS "walletBalance",
         created_at AS "createdAt"
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [profile.email],
    );

    let user = existing.rows[0] as
      | {
          id: number;
          name: string;
          email: string;
          role: "user" | "admin" | "worker";
          pointsBalance: number;
          walletBalance: number;
          createdAt: string;
        }
      | undefined;

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 10);
      const inserted = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'user')
         RETURNING
           id,
           name,
           email,
           role,
           points_balance AS "pointsBalance",
           wallet_balance AS "walletBalance",
           created_at AS "createdAt"`,
        [profile.name, profile.email, passwordHash],
      );
      user = inserted.rows[0] as typeof user;
    }

    const stats = await getUserStats(user!.id);
    let onboardingCompleted = false;
    if (user!.role === "worker") {
      const workerProfile = await pool.query(
        `SELECT onboarding_completed AS "onboardingCompleted"
         FROM worker_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [user!.id],
      );
      onboardingCompleted = workerProfile.rows[0]?.onboardingCompleted ?? false;
    }

    const token = signToken({
      userId: user!.id,
      email: user!.email,
      role: user!.role,
    });

    res.json({
      token,
      user: {
        id: user!.id,
        name: user!.name,
        email: user!.email,
        role: user!.role,
        pointsBalance: user!.pointsBalance,
        walletBalance: user!.walletBalance,
        createdAt: user!.createdAt,
        onboardingCompleted,
        issuesReported: stats.issuesReported,
        issuesResolved: stats.issuesResolved,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google sign-in failed";
    const isTokenError =
      message.includes("Invalid Google token") ||
      message.includes("not verified") ||
      message.includes("Wrong number of segments") ||
      message.includes("Token used too late");

    if (!isTokenError) {
      logger.error({ error }, "Google auth error");
    }

    res.status(isTokenError ? 401 : 500).json({
      error: isTokenError ? "Unauthorized" : "InternalError",
      message: isTokenError ? "Google sign-in could not be verified" : message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      res.status(400).json({ error: "BadRequest", message: "Email and password are required" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         password_hash AS "passwordHash",
         role,
         points_balance AS "pointsBalance",
         wallet_balance AS "walletBalance",
         created_at AS "createdAt"
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email.trim().toLowerCase()],
    );

    const user = rows[0] as
      | {
          id: number;
          name: string;
          email: string;
          passwordHash: string;
          role: "user" | "admin" | "worker";
          pointsBalance: number;
          walletBalance: number;
          createdAt: string;
        }
      | undefined;

    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const stats = await getUserStats(user.id);
    let onboardingCompleted = false;
    if (user.role === "worker") {
      const workerProfile = await pool.query(
        `SELECT onboarding_completed AS "onboardingCompleted"
         FROM worker_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [user.id],
      );
      onboardingCompleted = workerProfile.rows[0]?.onboardingCompleted ?? false;
    }
    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        pointsBalance: user.pointsBalance,
        walletBalance: user.walletBalance,
        createdAt: user.createdAt,
        onboardingCompleted,
        issuesReported: stats.issuesReported,
        issuesResolved: stats.issuesResolved,
      },
    });
  } catch (error) {
    logger.error({ error }, "Login error");
    res.status(500).json({ error: "InternalError", message: "Login failed" });
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         email,
         role,
         points_balance AS "pointsBalance",
         wallet_balance AS "walletBalance",
         created_at AS "createdAt"
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user!.userId],
    );

    const user = rows[0] as
      | {
          id: number;
          name: string;
          email: string;
          role: "user" | "admin" | "worker";
          pointsBalance: number;
          walletBalance: number;
          createdAt: string;
        }
      | undefined;

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    const stats = await getUserStats(user.id);
    let onboardingCompleted = false;
    if (user.role === "worker") {
      const workerProfile = await pool.query(
        `SELECT onboarding_completed AS "onboardingCompleted"
         FROM worker_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [user.id],
      );
      onboardingCompleted = workerProfile.rows[0]?.onboardingCompleted ?? false;
    }

    res.json({ ...user, ...stats, onboardingCompleted });
  } catch (error) {
    logger.error({ error }, "Get me error");
    res.status(500).json({ error: "InternalError", message: "Failed to get user" });
  }
});

export default router;
