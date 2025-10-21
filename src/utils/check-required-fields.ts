import { Response } from "express";

import { resBadRequest } from "./response.js";

/**
 * 필수 필드 검증
 * 배열 형태인 경우 배열의 모든 요소가 비어있지 않은지 검증
 * 문자열 형태인 경우 문자열이 비어있지 않은지 검증
 * 문자열 형태가 아닌 경우 필드가 비어있지 않은지 검증
 * @param fieldValues
 * @param msg
 * @param res
 * @returns
 */
export const checkRequiredFieldsAreProvided = (
  fieldValues: string[] | string | number | null,
  msg: string,
  res: Response,
): boolean => {
  // 배열 형태인 경우
  if (Array.isArray(fieldValues)) {
    for (const fieldValue of fieldValues) {
      if (!fieldValue) {
        resBadRequest(res, msg, null, 400, fieldValues);
        return false;
      }
    }
  }

  // 문자열 형태인 경우
  if (typeof fieldValues === "string") {
    if (!fieldValues) {
      resBadRequest(res, msg, null, 400, fieldValues);
      return false;
    }
  }

  // null | undefined 인 경우
  if (!fieldValues) {
    resBadRequest(res, msg);
    return false;
  }

  return true;
};
