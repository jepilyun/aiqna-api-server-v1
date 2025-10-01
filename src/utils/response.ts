import { Response } from "express";

/**
 * 400 에러 응답
 * Frontend Request 에서 제대로 된 요청이 오지 않음
 * 예) 필수 필드가 누락되었을 때
 * @param res
 * @param msg
 * @param alarm
 * @param statusCode
 * @returns
 */
export const resBadRequest = (
  res: Response,
  msg: string,
  alarm: string | null = null,
  statusCode: number = 400,
  missingFields: string[] | string | null = null,
  errorMsg?: string | null,
) => {
  res.status(statusCode).json({
    success: false,
    alarm,
    msg: errorMsg ? `${msg} ERROR: ${errorMsg}` : msg,
    missingFields,
  });
};

/**
 * 200 성공 응답
 * @param res
 * @param msg
 * @param alarm
 * @param statusCode
 * @param data
 * @returns
 */
export const resSuccess = <T>(
  res: Response,
  msg: string | null = null,
  alarm: string | null = null,
  statusCode: number = 200,
  data?: T,
  errorMsg?: string | null,
) => {
  res.status(statusCode).json({
    success: true,
    alarm,
    msg: errorMsg ? `${msg} ERROR: ${errorMsg}` : msg,
    dbResponse: data,
  });
};

/**
 * 400 에러 응답
 * 예) 데이터베이스 조회 중 오류 발생
 * @param res
 * @param error
 * @param msg
 * @param alarm
 * @param statusCode
 * @returns
 */
export const resError = (
  res: Response,
  error: unknown,
  msg: string | null = null,
  alarm: string | null = null,
  statusCode: number = 400,
) => {
  const message = error instanceof Error ? error.message : String(error);

  res.status(statusCode).json({
    success: false,
    error: message,
    alarm,
    msg: error ? `${msg} ERROR: ${(error as Error).message}` : msg,
  });

  return;
};
