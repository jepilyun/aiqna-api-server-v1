import { Request, Response } from "express";

/**
 * Ctrl For Create Content (Text, YouTube Video, Instagram, Blog)
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateContent(req: Request, res: Response) {
  console.log("ctrlAdminCreateContent");
  console.log("req", req);
  console.log("res", res);
}
