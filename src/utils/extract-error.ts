/**
 * 에러 정규화
 * @param err 에러
 * @returns 에러 정규화 결과
 */
export function extractError(err: unknown): { message: string; status?: string; code?: string } {
  let message = "";
  let status: string | undefined;
  let code: string | undefined;

  if (typeof err === "string") {
    message = err;
  } else if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") message = e.message;
    if (typeof e.status === "number" || typeof e.status === "string") status = String(e.status);
    if (typeof e.code === "number" || typeof e.code === "string") code = String(e.code);
  }
  return { message, status, code };
}