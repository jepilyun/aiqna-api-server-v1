import {
  F_TEXT_PROCESSING_LOG,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlTextProcessingLog,
  TSqlTextProcessingLogInsert,
  TSqlTextProcessingLogUpdate,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorTextProcessingLogDuplicate } from "../../errors/error-processing-log-text.js";

/**
 * DBSqlProcessingLogText
 * 텍스트 처리 로그 관련 데이터베이스 작업을 수행하는 클래스
 * 텍스트 처리 로그 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlProcessingLogText {
  /**
   * 텍스트 처리 로그 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 텍스트 처리 로그 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .select("*", { count: "exact" })
        .order(F_TEXT_PROCESSING_LOG.created_at.id, {
          ascending: false,
        })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * hash_key로 텍스트 처리 로그 조회
   * @param hashKey 해시 키
   * @returns 텍스트 처리 로그 목록과 총 개수
   */
  static async selectByHashKey(
    hashKey: string,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .select("*", { count: "exact" })
        .order(F_TEXT_PROCESSING_LOG.created_at.id, {
          ascending: true,
        })
        .eq(F_TEXT_PROCESSING_LOG.hash_key.id, hashKey)
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 조회(SELECT By HashKey) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 조회(SELECT By HashKey) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * processing_status로 텍스트 처리 로그 목록 조회
   * @param status 처리 상태 (pending, processing, completed, failed)
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 텍스트 처리 로그 목록과 총 개수
   */
  static async selectByStatus(
    status: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .select("*", { count: "exact" })
        .eq(F_TEXT_PROCESSING_LOG.processing_status.id, status)
        .order(F_TEXT_PROCESSING_LOG.created_at.id, {
          ascending: false,
        })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 상태별 조회(SELECT By Status) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 상태별 조회(SELECT By Status) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 처리 로그 등록 기능
   * @param logData 텍스트 처리 로그 정보
   * @returns 텍스트 처리 로그 정보
   */
  static async insert(
    logData: TSqlTextProcessingLogInsert,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .insert(logData)
        .select()
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorTextProcessingLogDuplicate(logData.hash_key);
        } else {
          throw new Error(
            `#1 텍스트 처리 로그 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 처리 로그 등록/수정 기능 (upsert)
   * hash_key가 이미 존재하면 업데이트, 없으면 새로 등록
   * @param logData 텍스트 처리 로그 정보
   * @returns 텍스트 처리 로그 정보
   */
  static async upsert(
    logData: TSqlTextProcessingLogInsert,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .upsert(logData, {
          onConflict: "hash_key",
          ignoreDuplicates: false,
        })
        .select()
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 처리 로그 수정 기능
   * @param hashKey 해시 키
   * @param updateData 수정할 텍스트 처리 로그 정보
   * @returns 텍스트 처리 로그 정보
   */
  static async updateByHashKey(
    hashKey: string,
    updateData: TSqlTextProcessingLogUpdate,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .update(updateData)
        .eq(F_TEXT_PROCESSING_LOG.hash_key.id, hashKey)
        .select()
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 처리 로그 삭제 기능
   * @param hashKey 해시 키
   * @returns 삭제된 텍스트 처리 로그 정보
   */
  static async deleteByHashKey(
    hashKey: string,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .delete()
        .eq(F_TEXT_PROCESSING_LOG.hash_key.id, hashKey)
        .select()
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 처리 실패한 로그들의 재시도 카운트 증가
   * @param hashKey 해시 키
   * @returns 업데이트된 텍스트 처리 로그 정보
   */
  static async incrementRetryCount(
    hashKey: string,
  ): Promise<ResponseDBSelect<TSqlTextProcessingLog[]>> {
    try {
      // 현재 retry_count 조회
      const { data: currentData } = await this.selectByHashKey(hashKey);

      if (!currentData || currentData.length === 0) {
        throw new Error("해당 해시 키의 로그를 찾을 수 없습니다.");
      }

      const currentRetryCount = currentData[0].retry_count || 0;

      // retry_count 증가
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.text_processing_logs)
        .update({
          retry_count: currentRetryCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq(F_TEXT_PROCESSING_LOG.hash_key.id, hashKey)
        .select()
        .overrideTypes<TSqlTextProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 처리 로그 재시도 카운트 증가(INCREMENT RETRY) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 처리 로그 재시도 카운트 증가(INCREMENT RETRY) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
