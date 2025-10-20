import { Request, Response } from "express";

/**
 * Ctrl For Get Vector
 * @param req
 * @param res
 * @returns
 */
export async function routeCtrlAdminVectorGet(req: Request, res: Response) {
  console.log("ctrlAdminVectorGet");
  console.log("req", req);
  console.log("res", res);
}
