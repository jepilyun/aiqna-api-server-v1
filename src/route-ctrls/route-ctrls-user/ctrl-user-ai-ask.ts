import { Request, Response } from "express";

/**
 * Ctrl For AI Ask
 * @param req
 * @param res
 * @returns
 */
export async function ctrlUserAiAsk(req: Request, res: Response) {
  console.log("ctrlUserAiAsk");
  console.log("req", req);
  console.log("res", res);
}
