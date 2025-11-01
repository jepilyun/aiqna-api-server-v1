import {
  SQL_DB_COLUMNS_YOUTUBE_VIDEO_LIST,
  F_YOUTUBE_VIDEO,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlYoutubeVideoDetail,
  TSqlYoutubeVideoDetailInsert,
  TSqlYoutubeVideoDetailUpdate,
  TSqlYoutubeVideoList,
  LIST_LIMIT,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorYoutubeVideoDuplicate } from "../../errors/error-youtube-video.js";
import { youtube_v3 } from "googleapis";

/**
 * DBSqlYoutubeVideo
 * Youtube 비디오 관련 데이터베이스 작업을 수행하는 클래스
 * Youtube 비디오 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlYoutubeVideo {
  /**
   * Youtube 비디오 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Youtube 비디오 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoList[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .select(SQL_DB_COLUMNS_YOUTUBE_VIDEO_LIST.join(","), { count: "exact" })
        .order(F_YOUTUBE_VIDEO.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlYoutubeVideoList[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * video_id로 Youtube 비디오 조회
   * @param videoId 비디오 아이디
   * @returns Youtube 비디오 상세 정보
   */
  static async selectByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoDetail[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .select("*", { count: "exact" })
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .order(F_YOUTUBE_VIDEO.created_at.id, { ascending: true })
        .overrideTypes<TSqlYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 조회(SELECT By VideoId) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 조회(SELECT By VideoId) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 등록 기능
   * @param log Youtube 비디오 정보
   * @returns Youtube 비디오 정보
   */
  static async insert(
    log: TSqlYoutubeVideoDetailInsert,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .insert(log)
        .select()
        .overrideTypes<TSqlYoutubeVideoDetail[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorYoutubeVideoDuplicate(log.video_id);
        } else {
          throw new Error(
            `#1 Youtube 비디오 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * YouTube API 데이터를 사용한 비디오 등록/수정 (upsert)
   * YouTube API v3 Schema를 받아 DB 저장용 함수(RPC)를 통해 처리
   * @param json YouTube API v3 Schema$Video 객체
   * @param isShorts 비디오 종류 (true: 쇼츠, false: 비디오)
   * @returns Youtube 비디오 정보
   */
  static async upsert(
    json: youtube_v3.Schema$Video,
    isShorts: boolean,
  ): Promise<ResponseDBSelect<{ video_id: string }[]>> {
    try {
      const { data, error } = await supabaseClient
        .rpc("upsert_youtube_video_api_data", {
          p_video_data: json,
          p_is_shorts: isShorts,
        })
        .single<string>(); // ✅ 문자열로 받기

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      // video_id를 문자열로 반환받음
      return { data: data ? [{ video_id: data }] : [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 정보 수정 기능
   * @param videoId 비디오 아이디
   * @param logUpdate Youtube 비디오 수정 정보
   * @returns Youtube 비디오 정보
   */
  static async updateByVideoId(
    videoId: string,
    updateData: TSqlYoutubeVideoDetailUpdate,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .update(updateData)
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * AI 요약 업데이트
   */
  static async updateSummaryByVideoId(
    videoId: string,
    updates: {
      ai_summary?: string;
      main_topics?: string[];
      key_points?: string[];
      keywords?: string[];
    },
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .update(updates)
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .select();

      if (error) {
        throw new Error(`Failed to update video: ${error.message}`);
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to update video");
    }
  }

  /**
   * Youtube 비디오 삭제 기능
   * @param videoId 비디오 아이디
   * @returns 삭제된 Youtube 비디오 정보
   */
  static async deleteByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .delete()
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
