import { Request, Response } from "express";

/**
 * Ctrl For Process Status of content
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminProcessStatus(req: Request, res: Response) {
  console.log("ctrlAdminProcessStatus");
  console.log("req", req);
  console.log("res", res);
}
