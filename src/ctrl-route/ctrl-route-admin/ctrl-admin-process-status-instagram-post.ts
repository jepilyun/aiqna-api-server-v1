import { Request, Response } from "express";

/**
 * Ctrl For Process Status of Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminProcessStatusInstagramPost(req: Request, res: Response) {
  console.log("ctrlAdminProcessStatusInstagramPost");
  console.log("req", req);
  console.log("res", res);
}
