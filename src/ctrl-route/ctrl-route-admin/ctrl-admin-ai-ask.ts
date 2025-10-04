import { Request, Response } from "express";

/**
 * Ctrl For AI Ask
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminAiAsk(req: Request, res: Response) {
  console.log("ctrlAdminAiAsk");
  console.log("req", req);
  console.log("res", res);
}
