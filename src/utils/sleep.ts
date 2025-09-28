/**
 * sleep 함수
 * @param ms 밀리초
 * @returns
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
