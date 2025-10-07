import { MAX_RETRIES } from "../consts/const.js";
import { isRetryableError } from "./is-retryable-error.js";
import { sleep } from "./sleep.js";

/**
 * 재시도 로직 추상화
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retryCount: number,
  operationName: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`${operationName} failed:`, error);

    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      console.log(`Retrying ${operationName} (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(1000 * (retryCount + 1));
      return withRetry(fn, retryCount + 1, operationName);
    }

    throw error;
  }
}