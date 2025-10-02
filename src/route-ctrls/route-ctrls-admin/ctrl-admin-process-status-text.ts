import { Request, Response } from "express";

/**
 * Ctrl For Process Status of Text
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminProcessStatusText(req: Request, res: Response) {
  console.log("ctrlAdminProcessStatusText");
  console.log("req", req);
  console.log("res", res);
}
