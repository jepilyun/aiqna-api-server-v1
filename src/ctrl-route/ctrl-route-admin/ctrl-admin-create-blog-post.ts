import { Request, Response } from "express";

/**
 * Ctrl For Create Blog Post
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminCreateBlogPost(req: Request, res: Response) {
  console.log("ctrlAdminCreateBlogPost");
  console.log("req", req);
  console.log("res", res);
}
