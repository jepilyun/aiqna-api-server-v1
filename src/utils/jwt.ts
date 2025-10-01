import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Admin JWT 페이로드
export interface AdminTokenPayload extends JwtPayload {
  admin_id: string;
  email: string;
  name?: string;
  is_active: boolean;
  level?: string;
}

// User JWT 페이로드
export interface UserTokenPayload extends JwtPayload {
  user_id: string;
  email: string;
  name?: string;
  is_active: boolean;
}

// 토큰 생성용 통합 페이로드 (exp 등 제외)
interface TokenCreatePayload {
  admin_id?: string;
  user_id?: string;
  email: string;
  name?: string;
  is_active: boolean;
  level?: string;
}

/**
 * Sign Token
 * @param payload - admin_id 또는 user_id 중 하나 필수
 * @param expiresIn - 만료 시간 (기본 1일)
 * @returns JWT 토큰
 */
export const signToken = (payload: TokenCreatePayload, expiresIn?: string): string => {
  const expires = expiresIn || "1d";

  return jwt.sign(payload, JWT_SECRET, { expiresIn: expires } as SignOptions);
};

/**
 * Verify Token
 * @param token
 * @returns TokenCreatePayload | null
 */
export const verifyToken = (token: string | null | undefined): TokenCreatePayload | null => {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET) as TokenCreatePayload;
  } catch (error: unknown) {
    console.log("Error in verifyToken: ", error);
    return null;
  }
};

/**
 * Verify Token Ignore Expiration
 * @param token
 * @returns
 */
export const verifyTokenIgnoreExpiration = (
  token: string,
): TokenCreatePayload => {
  return jwt.verify(token, JWT_SECRET, {
    ignoreExpiration: true,
  }) as TokenCreatePayload;
};

// 토큰 검증 결과 타입
interface TokenVerificationResult {
  payload: TokenCreatePayload | null;
  expired: boolean;
  error: Error | null;
}

/**
 * Safe Verify Token
 * @param token
 * @returns
 */
export const safeVerifyToken = (token: string): TokenVerificationResult => {
  try {
    const payload = verifyToken(token);
    return { payload, expired: false, error: null };
  } catch (error: unknown) {
    const errorObj =
      error instanceof Error ? error : new Error("Unknown error");

    if (errorObj.name === "TokenExpiredError") {
      try {
        const payload = verifyTokenIgnoreExpiration(token);
        return { payload, expired: true, error: errorObj };
      } catch (decodeError) {
        const decodeErrorObj =
          decodeError instanceof Error
            ? decodeError
            : new Error("Decode error");
        return { payload: null, expired: true, error: decodeErrorObj };
      }
    }
    return { payload: null, expired: false, error: errorObj };
  }
};
