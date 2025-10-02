import { Request, Response } from "express";

/**
 * Ctrl For Process Status of Blog Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminProcessStatusBlogPost(req: Request, res: Response) {
  console.log("ctrlAdminProcessStatusBlogPost");
  console.log("req", req);
  console.log("res", res);
}
