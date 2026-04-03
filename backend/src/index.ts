import { initializeDatabase } from "./db/init.js";
import { pool } from "./db/pool.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import app from "./app.js";

async function bootstrap() {
  await initializeDatabase();

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "Civic Samadhan backend listening");
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error({ error }, "Failed to start backend");
  process.exit(1);
});
