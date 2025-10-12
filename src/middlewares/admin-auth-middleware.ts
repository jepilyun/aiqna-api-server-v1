import cookie from "cookie";
import { COOKIE_NAME } from "aiqna_common_v1";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { MSG_MIDDLEWARE } from "../consts/msg/msg-middleware.js";
import { clearAuthCookies } from "../utils/clear-cookies.js";
import { AdminTokenPayload, signToken } from "../utils/jwt.js";
import { resBadRequest } from "../utils/response.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Express res.locals 타입 확장
declare module "express-serve-static-core" {
  interface Locals {
    admin?: AdminTokenPayload;
  }
}

export const adminAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userCookie = req.headers.cookie;
  const cookies = cookie.parse(userCookie || "");

  const accessToken = cookies[COOKIE_NAME.access_token_admin];
  const refreshToken = cookies[COOKIE_NAME.refresh_token_admin];

  if (!accessToken) {
    clearAuthCookies(res);
    resBadRequest(res, MSG_MIDDLEWARE.no_access_token, null);
    return;
  }

  try {
    // 먼저 access token이 유효한지 확인
    try {
      const accessTokenPayload = jwt.verify(
        accessToken,
        JWT_SECRET,
      ) as AdminTokenPayload;
      res.locals.admin = accessTokenPayload;
      return next();
    } catch (accessError: unknown) {
      // access token이 만료된 경우에만 refresh token 처리
      const isTokenExpiredError =
        accessError instanceof Error &&
        accessError.name === "TokenExpiredError";

      if (!isTokenExpiredError) {
        throw accessError; // 다른 에러는 외부 catch로 전달
      }

      console.log("Access token expired, checking refresh token");

      if (!refreshToken) {
        clearAuthCookies(res);
        resBadRequest(res, MSG_MIDDLEWARE.no_refresh_token, null);
        return;
      }

      try {
        // refresh token 검증
        jwt.verify(refreshToken, JWT_SECRET) as AdminTokenPayload;

        // 만료된 access token에서 페이로드 추출 (만료 무시)
        const expiredAccessPayload = jwt.verify(accessToken, JWT_SECRET, {
          ignoreExpiration: true,
        }) as AdminTokenPayload;

        console.log("Refresh token valid, issuing new access token");

        // 새로운 access 토큰 발급
        const newAccessToken = signToken({
          admin_id: expiredAccessPayload.admin_id,
          email: expiredAccessPayload.email,
          name: expiredAccessPayload.name,
          is_active: expiredAccessPayload.is_active,
          level: expiredAccessPayload.level,
        });

        res.setHeader("Set-Cookie", [
          cookie.serialize(COOKIE_NAME.access_token_admin, newAccessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 30, // 30일
            path: "/",
          }),
        ]);

        req.headers.authorization = `Bearer ${newAccessToken}`;
        res.locals.admin = expiredAccessPayload;
        return next();
      } catch (refreshError: unknown) {
        console.log("Refresh token invalid or expired:", refreshError);
        clearAuthCookies(res);
        resBadRequest(res, MSG_MIDDLEWARE.refresh_token_expired, null);
        return;
      }
    }
  } catch (error) {
    console.error("Authentication error:", error);
    clearAuthCookies(res);
    resBadRequest(res, MSG_MIDDLEWARE.error, null);
    return;
  }
};

export default adminAuthMiddleware;
