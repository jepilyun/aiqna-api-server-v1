// utils/retry/fetch-with-retry.ts
import { withRetry } from "./retry-common.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

interface FetchRetryError extends Error {
  response?: Response;
}

/**
 * HTTP 요청 전용 재시도 (Rate Limit, User-Agent 등 처리)
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  baseDelay: number = 2000,
  maxDelay: number = 30000,
): Promise<Response> {
  return withRetry(
    async () => {
      // User-Agent 및 헤더 설정
      const headers = new Headers(options.headers);
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", getRandomUserAgent());
      }
      if (!headers.has("Accept-Language")) {
        headers.set("Accept-Language", "en-US,en;q=0.9,ko;q=0.8");
      }
      if (!headers.has("Accept")) {
        headers.set(
          "Accept",
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        );
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(15000),
      });

      // Rate Limit (429)
      if (response.status === 429) {
        const error = new Error("Rate limit exceeded") as FetchRetryError;
        error.response = response;
        throw error;
      }

      // 서버 에러 (5xx)
      if (response.status >= 500) {
        const error = new Error(
          `Server error ${response.status}`,
        ) as FetchRetryError;
        error.response = response;
        throw error;
      }

      // 기타 HTTP 에러
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;
    },
    {
      maxRetries,
      baseDelay,
      maxDelay,
      operationName: "HTTP request",
      // HTTP 특화 재시도 로직
      shouldRetry: (error) => {
        const err = error as FetchRetryError;

        // Rate Limit: 더 보수적 백오프
        if (err.response?.status === 429) {
          return true;
        }

        // 서버 에러: 재시도
        if (err.response?.status && err.response.status >= 500) {
          return true;
        }

        // 네트워크 에러: 재시도
        if (
          error instanceof TypeError ||
          (error as Error).name === "AbortError" ||
          (error as Error).message?.includes("timeout") ||
          (error as Error).message?.includes("ECONNRESET")
        ) {
          return true;
        }

        // 기타 HTTP 에러 (4xx): 재시도 안 함
        return false;
      },
      // HTTP 특화 로깅
      onRetry: (error, attemptNum, waitTime) => {
        const err = error as FetchRetryError;

        // Rate Limit: Retry-After 헤더 확인
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers.get("Retry-After");
          if (retryAfter) {
            const retrySeconds = parseInt(retryAfter);
            if (!isNaN(retrySeconds)) {
              console.log(
                `⚠️ Rate limited (429). Retry-After: ${retrySeconds}s`,
              );
            }
          }
        }

        // 서버 에러 추가 로깅
        if (err.response?.status && err.response.status >= 500) {
          console.log(
            `⚠️ Server returned ${err.response.status}. Will retry in ${Math.round(waitTime / 1000)}s`,
          );
        }
      },
    },
  );
}

/**
 * YouTube 자막 전용 (더 보수적 설정)
 */
export async function fetchYouTubeTranscriptWithRetry(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetchWithRetry(
    url,
    options,
    3, // 3회 재시도
    3000, // 3초 기본 대기
    60000, // 최대 60초
  );
}
