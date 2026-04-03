import type { Request } from "express";
import type { JwtPayload } from "../lib/jwt.js";

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
