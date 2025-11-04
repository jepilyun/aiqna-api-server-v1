import {
  F_INSTAGRAM_POST,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlInstagramPostList,
  TSqlInstagramPostDetail,
  TSqlInstagramPostDetailInsert,
  TSqlInstagramPostDetailUpdate,
  SQL_DB_COLUMNS_INSTAGRAM_POST_LIST,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorInstagramPostDuplicate } from "../../errors/error-instagram-post.js";

/**
 * DBSqlInstagramPost
 * Instagram 포스트 관련 데이터베이스 작업을 수행하는 클래스
 * Instagram 포스트 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlInstagramPost {
  /**
   * Instagram 포스트 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Instagram 포스트 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlInstagramPostList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .select(SQL_DB_COLUMNS_INSTAGRAM_POST_LIST.join(", "), {
          count: "exact",
        })
        .order(F_INSTAGRAM_POST.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlInstagramPostList[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * instagram_post_url로 Instagram 포스트 조회
   * @param postUrl Instagram 포스트 URL
   * @returns Instagram 포스트 상세 정보
   */
  static async selectByPostUrl(
    postUrl: string,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .select("*", { count: "exact" })
        .eq(F_INSTAGRAM_POST.instagram_post_url.id, postUrl)
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 조회(SELECT By PostUrl) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 조회(SELECT By PostUrl) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * instagram_post_url로 Instagram 포스트 조회
   * @param uuid36 Instagram 포스트 URL
   * @returns Instagram 포스트 상세 정보
   */
  static async selectByUuid36(
    uuid36: string,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .select("*", { count: "exact" })
        .eq(F_INSTAGRAM_POST.uuid_36.id, uuid36)
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 조회(SELECT By Uuid36) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 조회(SELECT By Uuid36) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * user_id로 Instagram 포스트 목록 조회
   * @param userId 사용자 아이디
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Instagram 포스트 목록과 총 개수
   */
  static async selectByUserId(
    userId: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlInstagramPostList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .select(SQL_DB_COLUMNS_INSTAGRAM_POST_LIST.join(", "), {
          count: "exact",
        })
        .eq(F_INSTAGRAM_POST.user_id.id, userId)
        .order(F_INSTAGRAM_POST.published_date.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlInstagramPostList[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 조회(SELECT By UserId) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 조회(SELECT By UserId) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * post_type으로 Instagram 포스트 목록 조회
   * @param postType 포스트 타입 (image, video, carousel, reel, story)
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Instagram 포스트 목록과 총 개수
   */
  static async selectByPostType(
    postType: string,
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlInstagramPostList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .select(SQL_DB_COLUMNS_INSTAGRAM_POST_LIST.join(", "), {
          count: "exact",
        })
        .eq(F_INSTAGRAM_POST.post_type.id, postType)
        .order(F_INSTAGRAM_POST.published_date.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlInstagramPostList[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 조회(SELECT By PostType) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 조회(SELECT By PostType) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Instagram 포스트 등록 기능
   * @param post Instagram 포스트 정보
   * @returns Instagram 포스트 정보
   */
  static async insert(
    post: TSqlInstagramPostDetailInsert,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .insert(post)
        .select()
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorInstagramPostDuplicate(post.instagram_post_url);
        } else {
          throw new Error(
            `#1 Instagram 포스트 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Instagram 포스트 등록/수정 기능 (upsert)
   * instagram_post_url이 이미 존재하면 업데이트, 없으면 새로 등록
   * @param post Instagram 포스트 정보
   * @returns Instagram 포스트 정보
   */
  static async upsert(
    post: TSqlInstagramPostDetailInsert,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .upsert(post, {
          onConflict: "instagram_post_url",
          ignoreDuplicates: false,
        })
        .select()
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Instagram 포스트 정보 수정 기능
   * @param postUrl Instagram 포스트 URL
   * @param postUpdate Instagram 포스트 수정 정보
   * @returns Instagram 포스트 정보
   */
  static async updateByPostUrl(
    postUrl: string,
    postUpdate: TSqlInstagramPostDetailUpdate,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .update(postUpdate)
        .eq(F_INSTAGRAM_POST.instagram_post_url.id, postUrl)
        .select()
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Instagram 포스트 정보 수정 기능
   * @param uuid36 Instagram 포스트 UUID36
   * @param postUpdate Instagram 포스트 수정 정보
   * @returns Instagram 포스트 정보
   */
  static async updateByUuid36(
    uuid36: string,
    postUpdate: TSqlInstagramPostDetailUpdate,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .update(postUpdate)
        .eq(F_INSTAGRAM_POST.uuid_36.id, uuid36)
        .select()
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 정보 수정(UPDATE By Uuid36) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 정보 수정(UPDATE By Uuid36) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Instagram 포스트 삭제 기능
   * @param uuid36 Instagram 포스트 UUID36
   * @returns 삭제된 Instagram 포스트 정보
   */
  static async deleteByUuid36(
    uuid36: string,
  ): Promise<ResponseDBSelect<TSqlInstagramPostDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.instagram_posts)
        .delete()
        .eq(F_INSTAGRAM_POST.uuid_36.id, uuid36)
        .select()
        .overrideTypes<TSqlInstagramPostDetail[]>();

      if (error) {
        throw new Error(
          `#1 Instagram 포스트 정보 삭제(DELETE By Uuid36) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return {
        data: (data || []) as TSqlInstagramPostDetail[],
        count: count || 0,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Instagram 포스트 정보 삭제(DELETE By Uuid36) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
