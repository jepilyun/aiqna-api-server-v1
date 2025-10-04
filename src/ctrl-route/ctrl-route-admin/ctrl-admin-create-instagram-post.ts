import { Request, Response } from "express";

/**
 * Ctrl For Create Instagram Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateInstagramPost(req: Request, res: Response) {
  console.log("ctrlAdminCreateInstagramPost");
  console.log("req", req);
  console.log("res", res);
}
