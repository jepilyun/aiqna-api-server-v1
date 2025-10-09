// utils/retry/with-retry.ts
import { sleep } from "../sleep.js";

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  operationName?: string;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, waitTime: number) => void;
}

/**
 * 범용 재시도 로직
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    operationName = "Operation",
    shouldRetry = (error) => {
      // 기본 재시도 가능 에러
      return (
        error instanceof TypeError ||
        (error as Error).name === "AbortError" ||
        (error as Error).message?.includes("timeout") ||
        (error as Error).message?.includes("ECONNRESET") ||
        (error as Error).message?.includes("ECONNREFUSED")
      );
    },
    onRetry,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`✓ ${operationName} succeeded after ${attempt} retries`);
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      const isLastAttempt = attempt === maxRetries;

      if (!shouldRetry(error, attempt) || isLastAttempt) {
        console.error(`❌ ${operationName} failed:`, lastError.message);
        throw lastError;
      }

      const waitTime = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      console.log(
        `⚠️ ${operationName} failed. Retrying (${attempt + 1}/${maxRetries}) after ${Math.round(waitTime / 1000)}s...`,
      );

      if (onRetry) {
        onRetry(error, attempt, waitTime);
      }

      await sleep(waitTime);
    }
  }

  throw lastError || new Error(`${operationName} failed after retries`);
}