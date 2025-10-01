import { COOKIE_NAME } from "aiqna_common_v1";
import { Response } from "express";

/**
 * Clear Auth Cookies
 * @param res
 */
export const clearAuthCookies = (res: Response) => {
  res.clearCookie(COOKIE_NAME.access_token_admin, { path: "/" });
  res.clearCookie(COOKIE_NAME.refresh_token_admin, { path: "/" });
};
