import { Request, Response } from "express";

/**
 * Ctrl For Delete Vector
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminVectorDelete(req: Request, res: Response) {
  console.log("ctrlAdminVectorDelete");
  console.log("req", req);
  console.log("res", res);
}
