import { sleep } from "./sleep.js";

/**
 * 재시도 로직이 포함된 fetch 함수
 * 네트워크 오류, 타임아웃, Rate Limit 등을 처리
 * 
 * @param url - 요청할 URL
 * @param options - fetch 옵션
 * @param maxRetries - 최대 재시도 횟수 (기본: 3회)
 * @param retryDelay - 기본 재시도 대기 시간 (기본: 1000ms)
 * @returns fetch Response 객체
 * 
 * @example
 * // 기본 사용 (3회 재시도, 1초 대기)
 * const response = await fetchWithRetry('https://example.com/data');
 * 
 * // 커스텀 재시도 설정 (5회 재시도, 2초 대기)
 * const response = await fetchWithRetry(
 *   'https://example.com/data',
 *   { method: 'GET' },
 *   5,
 *   2000
 * );
 * 
 * @example
 * // Rate Limit 처리 시나리오:
 * // 1차 시도 → 429 에러 → Retry-After: 5초 대기
 * // 2차 시도 → 성공
 * 
 * // 네트워크 오류 처리 시나리오:
 * // 1차 시도 → timeout → 1초 대기
 * // 2차 시도 → timeout → 2초 대기 (지수 백오프)
 * // 3차 시도 → timeout → 4초 대기
 * // 4차 시도 → 성공
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      });

      // Rate Limit 체크 (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : retryDelay * Math.pow(2, attempt); // 지수 백오프: 1초 → 2초 → 4초

        if (attempt < maxRetries) {
          console.log(`Rate limited. Retrying after ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
        throw new Error("Rate limit exceeded after max retries");
      }

      // 서버 에러 재시도 (500, 502, 503 등)
      if (response.status >= 500 && attempt < maxRetries) {
        console.log(
          `Server error ${response.status}. Retry ${attempt + 1}/${maxRetries}...`,
        );
        await sleep(retryDelay * Math.pow(2, attempt));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable =
        error instanceof TypeError || // 네트워크 오류 (연결 실패, DNS 오류 등)
        (error as Error).message.includes("timeout") ||
        (error as Error).message.includes("ECONNRESET");

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      console.log(`Network error. Retry ${attempt + 1}/${maxRetries}...`);
      await sleep(retryDelay * Math.pow(2, attempt));
    }
  }

  throw new Error("Max retries exceeded");
}


