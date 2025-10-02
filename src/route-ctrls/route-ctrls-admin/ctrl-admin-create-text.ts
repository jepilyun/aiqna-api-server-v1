import { Request, Response } from "express";

/**
 * Ctrl For Create Text
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateText(req: Request, res: Response) {
  console.log("ctrlAdminCreateText");
  console.log("req", req);
  console.log("res", res);
}
