import { Request, Response } from "express";

/**
 * Ctrl For Create Vector
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminVectorCreate(req: Request, res: Response) {
  console.log("ctrlAdminVectorCreate");
  console.log("req", req);
  console.log("res", res);
}
