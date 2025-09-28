/**
 * 재시도 가능한 에러인지 판단
 * @param error 에러
 * @returns 재시도 가능한 에러인지 여부
 */
export function isRetryableError(error: unknown): boolean {
  const retryableMessages = [
    "timeout",
    "ECONNRESET",
    "ETIMEDOUT",
    "rate limit",
    "temporarily unavailable",
  ];

  return retryableMessages.some(
    (msg) =>
      error instanceof Error &&
      error.message?.toLowerCase().includes(msg.toLowerCase()),
  );
}
