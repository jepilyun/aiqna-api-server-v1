import {
  F_BLOG_POST,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlBlogPostList,
  TSqlBlogPostDetail,
  TSqlBlogPostDetailInsert,
  TSqlBlogPostDetailUpdate,
  SQL_DB_COLUMNS_BLOG_POST_LIST,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorBlogPostDuplicate } from "../../errors/error-blog-post.js";

/**
 * DBSqlBlogPost
 * 블로그 포스트 관련 데이터베이스 작업을 수행하는 클래스
 * 블로그 포스트 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlBlogPost {
  /**
   * 블로그 포스트 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns 블로그 포스트 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlBlogPostList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .select(SQL_DB_COLUMNS_BLOG_POST_LIST.join(", "), { count: "exact" })
        .order(F_BLOG_POST.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlBlogPostList[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * blog_post_url로 블로그 포스트 조회
   * @param postUrl 블로그 포스트 URL
   * @returns 블로그 포스트 상세 정보
   */
  static async selectByPostUrl(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlBlogPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .select("*", { count: "exact" })
        .eq(F_BLOG_POST.blog_post_url.id, postUrl)
        .overrideTypes<TSqlBlogPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 조회(SELECT By PostUrl) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlBlogPostDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 조회(SELECT By PostUrl) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 등록 기능
   * @param post 블로그 포스트 정보
   * @returns 블로그 포스트 정보
   */
  static async insert(
    post: TSqlBlogPostDetailInsert,
  ): Promise<ResponseDBSelect<TSqlBlogPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .insert(post)
        .select()
        .overrideTypes<TSqlBlogPostDetail[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorBlogPostDuplicate(post.blog_post_url);
        } else {
          throw new Error(
            `#1 블로그 포스트 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: (data || []) as TSqlBlogPostDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 등록/수정 기능 (upsert)
   * blog_post_url이 이미 존재하면 업데이트, 없으면 새로 등록
   * @param post 블로그 포스트 정보
   * @returns 블로그 포스트 정보
   */
  static async upsert(
    post: TSqlBlogPostDetailInsert,
  ): Promise<ResponseDBSelect<TSqlBlogPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .upsert(post, {
          onConflict: "blog_post_url",
          ignoreDuplicates: false,
        })
        .select()
        .overrideTypes<TSqlBlogPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlBlogPostDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 정보 수정 기능
   * @param postUrl 블로그 포스트 URL
   * @param postUpdate 블로그 포스트 수정 정보
   * @returns 블로그 포스트 정보
   */
  static async updateByPostUrl(
    postUrl: string,
    postUpdate: TSqlBlogPostDetailUpdate,
  ): Promise<ResponseDBSelect<TSqlBlogPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .update(postUpdate)
        .eq(F_BLOG_POST.blog_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlBlogPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlBlogPostDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 블로그 포스트 삭제 기능
   * @param postUrl 블로그 포스트 URL
   * @returns 삭제된 블로그 포스트 정보
   */
  static async deleteByPostUrl(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlBlogPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.blog_posts)
        .delete()
        .eq(F_BLOG_POST.blog_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlBlogPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 블로그 포스트 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: (data || []) as TSqlBlogPostDetail[], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 블로그 포스트 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
