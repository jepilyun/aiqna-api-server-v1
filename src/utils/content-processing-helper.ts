// utils/content-processing-helper.ts
import { Response } from "express";

export type ProcessingCheckResult = {
  isProcessing: boolean;
  data?: unknown;
};

export type ProcessingConfig<T> = {
  // 데이터 추출
  extractKey: (data: T) => string;
  
  // 중복 체크
  checkExisting: (key: string) => Promise<ProcessingCheckResult>;
  
  // 백그라운드 프로세서
  processor: (data: T) => Promise<void>;
  
  // 성공 응답 생성
  createResponse: (key: string, isAlreadyProcessing: boolean) => {
    success: true;
    message: string;
    statusUrl: string;
    [key: string]: string | boolean;
  };
};

export class ContentProcessingHelper {
  /**
   * 공통 처리 파이프라인
   * 1. 키 추출
   * 2. 중복 처리 확인
   * 3. 응답 전송
   * 4. 백그라운드 처리
   */
  static async processContent<T>(
    res: Response,
    data: T,
    config: ProcessingConfig<T>
  ): Promise<void> {
    // 1. 키 추출
    const key = config.extractKey(data);

    // 2. 이미 처리 중인지 확인
    const existing = await config.checkExisting(key);
    const isAlreadyProcessing = existing.isProcessing;

    // 3. 응답 전송
    const response = config.createResponse(key, isAlreadyProcessing);
    res.json(response);

    // 4. 이미 처리 중이면 백그라운드 작업 스킵
    if (isAlreadyProcessing) {
      return;
    }

    // 5. 백그라운드 처리
    config.processor(data).catch((err) => {
      console.error(`Background processing failed for ${key}:`, err);
    });
  }

  /**
   * 표준 에러 응답
   */
  static sendError(
    res: Response,
    statusCode: number,
    error: string,
    message?: string
  ): void {
    res.status(statusCode).json({
      success: false,
      error,
      ...(message && { message }),
    });
  }
}