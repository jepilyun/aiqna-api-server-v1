/**
 * ProcessingCheckResult
 * 처리 중복 체크 결과
 */
export type TProcessingCheckResult = {
  isProcessing: boolean;
  data?: unknown;
};

/**
 * ProcessingConfig
 * 처리 설정
 */
export type TProcessingConfig<T> = {
  extractKey: (data: T) => string;
  checkExisting: (key: string) => Promise<TProcessingCheckResult>;
  processor: (data: T) => Promise<void>;
  createResponse: (
    key: string,
    isAlreadyProcessing: boolean,
  ) => {
    success: true;
    message: string;
    statusUrl: string;
    [key: string]: string | boolean;
  };
};

export type TProcessResult = {
  success: boolean;
  uniqueKey: string;
  status: "queued" | "already_processing";
  message?: string;
  statusUrl?: string;
  // 필요 시 확장 필드 추가 가능
};

/**
 * HelperContentProcessing
 * 콘텐츠 처리 유틸리티
 */
export class HelperContentProcessing {
  /**
   * 공통 처리 파이프라인 (응답 전송 금지)
   * 1) 키 추출 -> 2) 중복 확인 -> 3) 결과 payload 구성 -> 4) 백그라운드 큐잉
   * 컨트롤러에서 결과 배열을 모아 한 번만 res.json(...) 하세요.
   */
  static async processContent<T>(
    data: T,
    config: TProcessingConfig<T>,
  ): Promise<TProcessResult> {
    const key = config.extractKey(data);

    const existing = await config.checkExisting(key);
    const isAlreadyProcessing = existing.isProcessing;

    const resp = config.createResponse(key, isAlreadyProcessing);

    if (isAlreadyProcessing) {
      // 이미 처리 중이면 큐잉 생략
      return {
        success: true,
        uniqueKey: key,
        status: "already_processing",
        message: typeof resp.message === "string" ? resp.message : undefined,
        statusUrl:
          typeof resp.statusUrl === "string" ? resp.statusUrl : undefined,
      };
    }

    // 백그라운드 처리 (비동기 fire-and-forget)
    Promise.resolve()
      .then(() => config.processor(data))
      .catch((err) => {
        console.error(`Background processing failed for ${key}:`, err);
      });

    return {
      success: true,
      uniqueKey: key,
      status: "queued",
      message: typeof resp.message === "string" ? resp.message : undefined,
      statusUrl:
        typeof resp.statusUrl === "string" ? resp.statusUrl : undefined,
    };
  }

  /**
   * ❗ 컨트롤러에서만 사용: 헬퍼 내부에서는 호출하지 마세요.
   */
  static buildError(statusCode: number, error: string, message?: string) {
    return {
      statusCode,
      body: {
        success: false,
        error,
        ...(message && { message }),
      },
    };
  }
}
