import { Request } from "express";

/**
 * 클라이언트의 실제 IP 주소를 추출하는 함수
 * 다양한 프록시 환경(Cloudflare, nginx, AWS ELB 등)을 고려하여 우선순위에 따라 IP를 추출
 *
 * 사용 예시:
 * const clientIp = getClientIp(req);
 * const clientIp = getClientIp(req, true); // 로깅 활성화
 */
export function getClientIp(
  req: Request,
  enableLogging: boolean = false,
): string | string[] {
  // 우선순위에 따른 IP 주소 추출
  const ipAddress =
    req.headers["cf-connecting-ip"] || // Cloudflare
    req.headers["x-forwarded-for"] || // 일반적인 프록시
    req.headers["x-real-ip"] || // nginx 등
    req.connection?.remoteAddress || // 직접 연결
    req.socket?.remoteAddress || // 소켓 연결
    "unknown-ip"; // 실패 시 기본값

  // x-forwarded-for는 여러 IP가 쉼표로 구분될 수 있으므로 첫 번째 IP만 추출
  const cleanedIp =
    typeof ipAddress === "string" ? ipAddress.split(",")[0].trim() : ipAddress;

  if (enableLogging) {
    console.log("Client IP Address =====>", cleanedIp);
  }

  return cleanedIp;
}
