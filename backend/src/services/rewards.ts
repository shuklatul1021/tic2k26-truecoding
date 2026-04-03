import { pool } from "../db/pool.js";
import { env } from "../config/env.js";

const USER_REWARD_POINTS = 100;
const WORKER_REWARD_POINTS = 80;
const WORKER_BONUS_POINTS = 40;

function toWalletAmount(points: number): number {
  return Number((points * env.pointToMoneyRate).toFixed(2));
}

export async function awardResolutionRewards(input: {
  issueId: number;
  reporterUserId: number;
  workerUserId?: number | null;
  dueAt?: string | Date | null;
}) {
  const now = new Date();
  const onTime =
    input.dueAt != null ? now.getTime() <= new Date(input.dueAt).getTime() : false;
  const workerPoints = input.workerUserId ? WORKER_REWARD_POINTS : 0;
  const bonusPoints = input.workerUserId && onTime ? WORKER_BONUS_POINTS : 0;

  await pool.query(
    `UPDATE users
     SET points_balance = points_balance + $2,
         wallet_balance = wallet_balance + $3
     WHERE id = $1`,
    [input.reporterUserId, USER_REWARD_POINTS, toWalletAmount(USER_REWARD_POINTS)],
  );

  if (input.workerUserId) {
    const totalWorkerPoints = workerPoints + bonusPoints;
    await pool.query(
      `UPDATE users
       SET points_balance = points_balance + $2,
           wallet_balance = wallet_balance + $3
       WHERE id = $1`,
      [
        input.workerUserId,
        totalWorkerPoints,
        toWalletAmount(totalWorkerPoints),
      ],
    );
  }

  await pool.query(
    `UPDATE issues
     SET reward_points = $2,
         worker_points = $3,
         worker_bonus_points = $4,
         resolved_at = NOW()
     WHERE id = $1`,
    [input.issueId, USER_REWARD_POINTS, workerPoints, bonusPoints],
  );
}
