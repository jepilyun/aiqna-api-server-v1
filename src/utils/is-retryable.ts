export function isRetryable(message: string, status?: string, code?: string): boolean {
  const hitText = /503|over capacity|internal_server_error|rate[_\s-]?limit/i.test(message);
  const hitCode = status === "429" || status === "503" || code === "429" || code === "503";
  return hitText || hitCode;
}