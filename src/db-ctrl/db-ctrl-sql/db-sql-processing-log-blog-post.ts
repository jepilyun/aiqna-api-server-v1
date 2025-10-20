import {
  F_PROCESSING_LOG_BLOG_POST,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlProcessingLogBlogPost,
  TSqlProcessingLogBlogPostInsert,
  TSqlProcessingLogBlogPostUpdate,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorBlogPostProcessingLogDuplicate } from "../../errors/error-processing-log-blog-post.js";

/**
 * DBSqlProcessingLogBlogPost
 * 블로그 포스트 처리 로그 관련 데이터베이스 작업을 수행하는 클래스
 * 블로그 포스트 처리 로그 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlProcessingLogBlogPost {
  /**
   * 블로그 포스트 처리 로그 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 블로그 포스트 처리 로그 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .select("*", { count: "exact" })
        .order(F_PROCESSING_LOG_BLOG_POST.created_at.id, {
          ascending: false,
        })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * blog_post_url로 블로그 포스트 처리 로그 조회
   * @param postUrl 블로그 포스트 URL
   * @returns 블로그 포스트 처리 로그 목록과 총 개수
   */
  static async selectByPostUrl(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .select("*", { count: "exact" })
        .order(F_PROCESSING_LOG_BLOG_POST.created_at.id, {
          ascending: true,
        })
        .eq(F_PROCESSING_LOG_BLOG_POST.blog_post_url.id, postUrl)
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 조회(SELECT By PostUrl) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 조회(SELECT By PostUrl) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * processing_status로 블로그 포스트 처리 로그 목록 조회
   * @param status 처리 상태 (pending, processing, completed, failed)
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 블로그 포스트 처리 로그 목록과 총 개수
   */
  static async selectByStatus(
    status: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .select("*", { count: "exact" })
        .eq(F_PROCESSING_LOG_BLOG_POST.processing_status.id, status)
        .order(F_PROCESSING_LOG_BLOG_POST.created_at.id, {
          ascending: false,
        })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 상태별 조회(SELECT By Status) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 상태별 조회(SELECT By Status) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 처리 로그 등록 기능
   * @param logData 블로그 포스트 처리 로그 정보
   * @returns 블로그 포스트 처리 로그 정보
   */
  static async insert(
    logData: TSqlProcessingLogBlogPostInsert,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .insert(logData)
        .select()
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorBlogPostProcessingLogDuplicate(logData.blog_post_url);
        } else {
          throw new Error(
            `#1 블로그 포스트 처리 로그 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 처리 로그 등록/수정 기능 (upsert)
   * blog_post_url이 이미 존재하면 업데이트, 없으면 새로 등록
   * @param logData 블로그 포스트 처리 로그 정보
   * @returns 블로그 포스트 처리 로그 정보
   */
  static async upsert(
    logData: TSqlProcessingLogBlogPostInsert,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .upsert(logData, {
          onConflict: "blog_post_url",
          ignoreDuplicates: false,
        })
        .select()
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 처리 로그 수정 기능
   * @param postUrl 블로그 포스트 URL
   * @param updateData 수정할 블로그 포스트 처리 로그 정보
   * @returns 블로그 포스트 처리 로그 정보
   */
  static async updateByPostUrl(
    postUrl: string,
    updateData: TSqlProcessingLogBlogPostUpdate,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .update(updateData)
        .eq(F_PROCESSING_LOG_BLOG_POST.blog_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 처리 로그 삭제 기능
   * @param postUrl 블로그 포스트 URL
   * @returns 삭제된 블로그 포스트 처리 로그 정보
   */
  static async deleteByPostUrl(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .delete()
        .eq(F_PROCESSING_LOG_BLOG_POST.blog_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 처리 실패한 로그들의 재시도 카운트 증가
   * @param postUrl 블로그 포스트 URL
   * @returns 업데이트된 블로그 포스트 처리 로그 정보
   */
  static async incrementRetryCount(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlProcessingLogBlogPost[]>> {
    try {
      // 현재 retry_count 조회
      const { data: currentData } = await this.selectByPostUrl(postUrl);

      if (!currentData || currentData.length === 0) {
        throw new Error("해당 포스트 URL의 로그를 찾을 수 없습니다.");
      }

      const currentRetryCount = currentData[0].retry_count || 0;

      // retry_count 증가
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.blog_post_processing_logs)
        .update({
          retry_count: currentRetryCount + 1,
          updated_at: new Date().toISOString(),
        })
        .eq(F_PROCESSING_LOG_BLOG_POST.blog_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlProcessingLogBlogPost[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 처리 로그 재시도 카운트 증가(INCREMENT RETRY) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 처리 로그 재시도 카운트 증가(INCREMENT RETRY) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
