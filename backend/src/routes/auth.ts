import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";
import { getUserStats } from "../db/queries.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

type AppRole = "user" | "admin" | "worker";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  pointsBalance: number;
  walletBalance: number;
  createdAt: string;
};

type LoginUserRow = UserRow & {
  passwordHash: string;
};

type WorkerProfileRow = {
  onboardingCompleted: boolean;
  workerVerified: boolean;
};

function requireWorker(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (req.user?.role !== "worker") {
    res.status(403).json({ error: "Forbidden", message: "Worker access required" });
    return;
  }
  next();
}

async function registerUser(
  name: string,
  email: string,
  password: string,
  role: AppRole,
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

  return rows[0] as UserRow;
}

async function getWorkerProfile(userId: number): Promise<WorkerProfileRow> {
  const workerProfile = await pool.query(
    `SELECT
       onboarding_completed AS "onboardingCompleted",
       is_verified AS "workerVerified"
     FROM worker_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId],
  );

  return {
    onboardingCompleted: workerProfile.rows[0]?.onboardingCompleted ?? false,
    workerVerified: workerProfile.rows[0]?.workerVerified ?? false,
  };
}

async function buildAuthUser(user: UserRow) {
  const stats = await getUserStats(user.id);
  const workerState =
    user.role === "worker"
      ? await getWorkerProfile(user.id)
      : { onboardingCompleted: false, workerVerified: false };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    pointsBalance: user.pointsBalance,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt,
    issuesReported: stats.issuesReported,
    issuesResolved: stats.issuesResolved,
    onboardingCompleted: workerState.onboardingCompleted,
    workerVerified: workerState.workerVerified,
  };
}

async function fetchUserByEmail(email: string) {
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
    [email],
  );

  return rows[0] as LoginUserRow | undefined;
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
      user: await buildAuthUser(user),
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

router.post("/register-admin", async (_req, res) => {
  res.status(403).json({
    error: "Forbidden",
    message: "Admin accounts are provisioned in the backend and cannot be created from the public app",
  });
});

router.post("/worker-login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      res.status(400).json({ error: "BadRequest", message: "Email and password are required" });
      return;
    }

    const user = await fetchUserByEmail(email.trim().toLowerCase());

    if (!user || user.role !== "worker") {
      res.status(401).json({
        error: "Unauthorized",
        message: "Worker account not found. Contact your admin for access.",
      });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: "worker" });

    res.json({
      token,
      user: await buildAuthUser(user),
    });
  } catch (error) {
    logger.error({ error }, "Worker login error");
    res.status(500).json({ error: "InternalError", message: "Worker login failed" });
  }
});

router.post("/worker-register", async (_req, res) => {
  res.status(403).json({
    error: "Forbidden",
    message: "Worker accounts are created by admins only",
  });
});

router.post("/worker-verify", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    requireWorker(req, res, async () => {
      const { name, password, roleTitle, skills, workLatitude, workLongitude, workAddress } = req.body as {
        name?: string;
        password?: string;
        roleTitle?: string;
        skills?: string[];
        workLatitude?: number;
        workLongitude?: number;
        workAddress?: string;
      };

      if (!name?.trim() || !password?.trim() || !roleTitle?.trim() || !Array.isArray(skills) || skills.length === 0) {
        res.status(400).json({
          error: "BadRequest",
          message: "Name, new password, role title and at least one skill are required",
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: "BadRequest",
          message: "Password must be at least 6 characters",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query("UPDATE users SET name = $2, password_hash = $3, updated_at = NOW() WHERE id = $1", [
        req.user!.userId,
        name.trim(),
        passwordHash,
      ]);
      await pool.query(
        `UPDATE worker_profiles
         SET is_verified = TRUE,
             verified_at = COALESCE(verified_at, NOW()),
             role_title = $2,
             skills = $3,
             work_latitude = $4,
             work_longitude = $5,
             work_address = $6,
             onboarding_completed = TRUE,
             updated_at = NOW()
         WHERE user_id = $1`,
        [
          req.user!.userId,
          roleTitle.trim(),
          skills.map((skill) => String(skill).trim()).filter(Boolean),
          typeof workLatitude === "number" ? workLatitude : null,
          typeof workLongitude === "number" ? workLongitude : null,
          workAddress?.trim() || null,
        ],
      );

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

      const user = rows[0] as UserRow | undefined;
      if (!user) {
        res.status(404).json({ error: "NotFound", message: "User not found" });
        return;
      }

      res.json({
        user: await buildAuthUser(user),
      });
    });
  } catch (error) {
    logger.error({ error }, "Worker verification error");
    res.status(500).json({ error: "InternalError", message: "Worker verification failed" });
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

    const user = await fetchUserByEmail(email.trim().toLowerCase());

    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });

    res.json({
      token,
      user: await buildAuthUser(user),
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

    const user = rows[0] as UserRow | undefined;

    if (!user) {
      res.status(404).json({ error: "NotFound", message: "User not found" });
      return;
    }

    res.json(await buildAuthUser(user));
  } catch (error) {
    logger.error({ error }, "Get me error");
    res.status(500).json({ error: "InternalError", message: "Failed to get user" });
  }
});

export default router;
