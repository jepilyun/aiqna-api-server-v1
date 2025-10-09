import {
  F_TEXT,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlTextList,
  TSqlTextDetail,
  TSqlTextDetailInsert,
  TSqlTextDetailUpdate,
  SQL_DB_COLUMNS_TEXT_LIST,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorTextDuplicate } from "../../errors/error-text.js";

/**
 * DBSqlText
 * 텍스트 관련 데이터베이스 작업을 수행하는 클래스
 * 텍스트 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlText {
  /**
   * 텍스트 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 텍스트 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlTextList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .select(SQL_DB_COLUMNS_TEXT_LIST.join(", "), { count: "exact" })
        .order(F_TEXT.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlTextList[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * hash_key로 텍스트 조회
   * @param hashKey 해시 키
   * @returns 텍스트 상세 정보
   */
  static async selectByHashKey(
    hashKey: string,
  ): Promise<ResponseDBSelect<TSqlTextDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .select("*", { count: "exact" })
        .eq(F_TEXT.hash_key.id, hashKey)
        .overrideTypes<TSqlTextDetail[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 조회(SELECT By HashKey) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlTextDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 조회(SELECT By HashKey) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 등록 기능
   * @param text 텍스트 정보
   * @returns 텍스트 정보
   */
  static async insert(
    text: TSqlTextDetailInsert,
  ): Promise<ResponseDBSelect<TSqlTextDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .insert(text)
        .select()
        .overrideTypes<TSqlTextDetail[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorTextDuplicate(text.hash_key);
        } else {
          throw new Error(
            `#1 텍스트 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: (data || []) as TSqlTextDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 등록/수정 기능 (upsert)
   * hash_key가 이미 존재하면 업데이트, 없으면 새로 등록
   * @param text 텍스트 정보
   * @returns 텍스트 정보
   */
  static async upsert(
    text: TSqlTextDetailInsert,
  ): Promise<ResponseDBSelect<TSqlTextDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .upsert(text, {
          onConflict: "hash_key",
          ignoreDuplicates: false,
        })
        .select()
        .overrideTypes<TSqlTextDetail[]>();

      if (error) {
        throw new Error(`#1 텍스트 Upsert 중 오류 발생 >>> ${error.message}`);
      }

      return { data: (data || []) as TSqlTextDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("#3 텍스트 Upsert 중 알 수 없는 오류가 발생했습니다.");
    }
  }

  /**
   * 텍스트 정보 수정 기능
   * @param hashKey 해시 키
   * @param textUpdate 텍스트 수정 정보
   * @returns 텍스트 정보
   */
  static async updateByHashKey(
    hashKey: string,
    textUpdate: TSqlTextDetailUpdate,
  ): Promise<ResponseDBSelect<TSqlTextDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .update(textUpdate)
        .eq(F_TEXT.hash_key.id, hashKey)
        .select()
        .overrideTypes<TSqlTextDetail[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlTextDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 텍스트 삭제 기능
   * @param hashKey 해시 키
   * @returns 삭제된 텍스트 정보
   */
  static async deleteByHashKey(
    hashKey: string,
  ): Promise<ResponseDBSelect<TSqlTextDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.texts)
        .delete()
        .eq(F_TEXT.hash_key.id, hashKey)
        .select()
        .overrideTypes<TSqlTextDetail[]>();

      if (error) {
        throw new Error(
          `#1 텍스트 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlTextDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 텍스트 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
