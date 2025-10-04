import { Request, Response } from "express";

/**
 * Ctrl For Get Vectors list
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminVectorsGetList(req: Request, res: Response) {
  console.log("ctrlAdminVectorsGetList");
  console.log("req", req);
  console.log("res", res);
}
