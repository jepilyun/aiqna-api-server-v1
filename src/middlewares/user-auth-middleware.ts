import cookie from "cookie";
import { COOKIE_NAME } from "aiqna_common_v1";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { MSG_MIDDLEWARE } from "../msg/msg-middleware.js";
import { clearAuthCookies } from "../utils/clear-cookies.js";
import { signToken, UserTokenPayload } from "../utils/jwt.js";
import { resBadRequest } from "../utils/response.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Express res.locals 타입 확장
declare module "express-serve-static-core" {
  interface Locals {
    user?: UserTokenPayload;
  }
}

export const userAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userCookie = req.headers.cookie;
  const cookies = cookie.parse(userCookie || "");

  const accessToken = cookies[COOKIE_NAME.access_token_user];
  const refreshToken = cookies[COOKIE_NAME.refresh_token_user];

  if (!accessToken) {
    clearAuthCookies(res);
    resBadRequest(res, MSG_MIDDLEWARE.no_access_token, null);
    return;
  }

  try {
    try {
      const accessTokenPayload = jwt.verify(
        accessToken,
        JWT_SECRET,
      ) as UserTokenPayload;
      res.locals.user = accessTokenPayload;
      return next();
    } catch (accessError: unknown) {
      const isTokenExpiredError =
        accessError instanceof Error &&
        accessError.name === "TokenExpiredError";

      if (!isTokenExpiredError) {
        throw accessError;
      }

      if (!refreshToken) {
        clearAuthCookies(res);
        resBadRequest(res, MSG_MIDDLEWARE.no_refresh_token, null);
        return;
      }

      try {
        jwt.verify(
          refreshToken,
          JWT_SECRET,
        ) as UserTokenPayload;

        const expiredAccessPayload = jwt.verify(accessToken, JWT_SECRET, {
          ignoreExpiration: true,
        }) as UserTokenPayload;

        const newAccessToken = signToken({
          user_id: expiredAccessPayload.user_id,
          email: expiredAccessPayload.email,
          name: expiredAccessPayload.name,
          is_active: expiredAccessPayload.is_active,
        }, "1h");

        res.setHeader("Set-Cookie", [
          cookie.serialize(COOKIE_NAME.access_token_user, newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60, // 1시간 (초 단위)
            path: "/",
          }),
        ]);

        req.headers.authorization = `Bearer ${newAccessToken}`;
        res.locals.user = expiredAccessPayload;
        return next();
      } catch (refreshError: unknown) {
        console.log("Refresh token invalid or expired:", refreshError);
        clearAuthCookies(res);
        resBadRequest(res, MSG_MIDDLEWARE.refresh_token_expired, null);
        return;
      }
    }
  } catch (error) {
    console.error("User authentication error:", error);
    clearAuthCookies(res);
    resBadRequest(res, MSG_MIDDLEWARE.error, null);
    return;
  }
};

export default userAuthMiddleware;