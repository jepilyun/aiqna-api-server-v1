import {
  F_PINECONE_VECTOR,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlPineconeVector,
  TSqlPineconeVectorInsert,
  TSqlPineconeVectorUpdate
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorPineconeVectorDuplicate } from "../../errors/error-pinecone-vector.js";

/**
 * DBSqlPineconeVector
 * Pinecone 벡터 관련 데이터베이스 작업을 수행하는 클래스
 * Pinecone 벡터 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlPineconeVector {
  /**
   * Pinecone 벡터 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Pinecone 벡터 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .select("*", { count: "exact" })
        .order(F_PINECONE_VECTOR.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * vector_id로 Pinecone 벡터 조회
   * @param vectorId 벡터 ID
   * @returns Pinecone 벡터 상세 정보
   */
  static async selectByVectorId(
    vectorId: string,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .select("*", { count: "exact" })
        .eq(F_PINECONE_VECTOR.vector_id.id, vectorId)
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 조회(SELECT By VectorId) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 조회(SELECT By VectorId) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * source_type과 source_id로 Pinecone 벡터 목록 조회
   * @param sourceType 소스 타입 (youtube_video, instagram_post, blog_post, text)
   * @param sourceId 소스 ID (video_id, url, hash_key 등)
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Pinecone 벡터 목록과 총 개수
   */
  static async selectBySource(
    sourceType: string,
    sourceId: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .select("*", { count: "exact" })
        .eq(F_PINECONE_VECTOR.source_type.id, sourceType)
        .eq(F_PINECONE_VECTOR.source_id.id, sourceId)
        .order(F_PINECONE_VECTOR.chunk_index.id, { ascending: true })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 조회(SELECT By Source) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 조회(SELECT By Source) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * status로 Pinecone 벡터 목록 조회
   * @param status 상태 (active, deleted, outdated)
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Pinecone 벡터 목록과 총 개수
   */
  static async selectByStatus(
    status: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .select("*", { count: "exact" })
        .eq(F_PINECONE_VECTOR.status.id, status)
        .order(F_PINECONE_VECTOR.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 조회(SELECT By Status) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 조회(SELECT By Status) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Pinecone 벡터 등록 기능
   * @param vector Pinecone 벡터 정보
   * @returns Pinecone 벡터 정보
   */
  static async insert(
    vector: TSqlPineconeVectorInsert,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .insert(vector)
        .select()
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorPineconeVectorDuplicate(vector.vector_id);
        } else {
          throw new Error(
            `#1 Pinecone 벡터 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Pinecone 벡터 등록/수정 기능 (upsert)
   * vector_id가 이미 존재하면 업데이트, 없으면 새로 등록
   * @param vector Pinecone 벡터 정보
   * @returns Pinecone 벡터 정보
   */
  static async upsert(
    vector: TSqlPineconeVectorInsert,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .upsert(vector, {
          onConflict: 'vector_id',
          ignoreDuplicates: false
        })
        .select()
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Pinecone 벡터 정보 수정 기능
   * @param vectorId 벡터 ID
   * @param vectorUpdate Pinecone 벡터 수정 정보
   * @returns Pinecone 벡터 정보
   */
  static async updateByVectorId(
    vectorId: string,
    vectorUpdate: TSqlPineconeVectorUpdate,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .update(vectorUpdate)
        .eq(F_PINECONE_VECTOR.vector_id.id, vectorId)
        .select()
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Pinecone 벡터 삭제 기능
   * @param vectorId 벡터 ID
   * @returns 삭제된 Pinecone 벡터 정보
   */
  static async deleteByVectorId(
    vectorId: string,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .delete()
        .eq(F_PINECONE_VECTOR.vector_id.id, vectorId)
        .select()
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 특정 소스의 모든 벡터 삭제
   * @param sourceType 소스 타입
   * @param sourceId 소스 ID
   * @returns 삭제된 Pinecone 벡터 정보
   */
  static async deleteBySource(
    sourceType: string,
    sourceId: string,
  ): Promise<ResponseDBSelect<TSqlPineconeVector[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.pinecone_vectors)
        .delete()
        .eq(F_PINECONE_VECTOR.source_type.id, sourceType)
        .eq(F_PINECONE_VECTOR.source_id.id, sourceId)
        .select()
        .overrideTypes<TSqlPineconeVector[]>();

      if (error) {
        throw new Error(
          `#1 Pinecone 벡터 정보 삭제(DELETE By Source) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlPineconeVector[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Pinecone 벡터 정보 삭제(DELETE By Source) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}