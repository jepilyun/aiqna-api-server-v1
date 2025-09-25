import {
  DB_COLUMNS_YOUTUBE_VIDEO_LIST,
  F_YOUTUBE_VIDEO,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TYoutubeVideoDetail,
  TYoutubeVideoDetailInsert,
  TYoutubeVideoDetailUpdate,
  TYoutubeVideoList,
} from "aiqna_common_v1";
import supabase from "../../config/supabase.js";
import { ErrorYoutubeVideoDuplicate } from "../../errors/error-youtube-video.js";

/**
 * DBSbYoutubeVideo
 * Youtube 비디오 관련 데이터베이스 작업을 수행하는 클래스
 * Youtube 비디오 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSbYoutubeVideo {
  /**
   * Youtube 비디오 목록 조회 : Frontend 에서 SSG 만들 때 현재 활성화된 Youtube 비디오 코드 추출하기 위함 ex. ["seoul", "busan"]
   * @param start
   * @param limit
   * @returns Youtube 비디오
   */
  static async selectList(
    start: number,
    limit: number = 36,
  ): Promise<ResponseDBSelect<TYoutubeVideoList[]>> {
    try {
      const query = supabase
        .from(SQL_DB_TABLE.youtube_videos)
        .select(DB_COLUMNS_YOUTUBE_VIDEO_LIST.join(","), { count: "exact" })
        .order(F_YOUTUBE_VIDEO.created_at.id, { ascending: false })
        .range(start, start + limit - 1);

      const { data, error, count } = await query
        .order(F_YOUTUBE_VIDEO.created_at.id, { ascending: true })
        .overrideTypes<TYoutubeVideoList[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          error.message ||
            "#2 Youtube 비디오 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
        );
      }
      throw new Error(
        "#3 Youtube 비디오 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 등록 기능
   * @param log Youtube 비디오 정보
   * @returns 
   */
  static async insert(
    log: TYoutubeVideoDetailInsert,
  ): Promise<ResponseDBSelect<TYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabase
        .from(SQL_DB_TABLE.youtube_videos)
        .insert(log)
        .select()
        .overrideTypes<TYoutubeVideoDetail[]>();

      if (error) {
        if (error.code === "23505") {
          // PRIMARY KEY 중복	23505	unique_violation
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
        throw new Error(
          error.message ||
            "#2 Youtube 비디오 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
        );
      }
      throw new Error(
        "#3 Youtube 비디오 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 목록 검색 (name, name_ko)
   * @param videoId 검색 키워드
   * @returns Youtube 비디오 목록과 총 개수
   */
  static async selectByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TYoutubeVideoDetail[]>> {
    try {
      const { data, error, count } = await supabase
        .from(SQL_DB_TABLE.youtube_videos)
        .select("*", { count: "exact" })
        .order(F_YOUTUBE_VIDEO.created_at.id, { ascending: true })
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .overrideTypes<TYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 목록 검색(SEARCH By Keyword) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          error.message ||
            "#2 Youtube 비디오 목록 검색(SEARCH By Keyword) 중 알 수 없는 오류가 발생했습니다.",
        );
      }
      throw new Error(
        "#3 Youtube 비디오 목록 검색(SEARCH By Keyword) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 정보 수정 기능
   * @param videoId 비디오 아이디
   * @param logUpdate Youtube 비디오 정보
   * @returns Youtube 비디오 정보
   */
  static async updateDetailByVideoId(
    videoId: string,
    logUpdate: TYoutubeVideoDetailUpdate,
  ): Promise<ResponseDBSelect<TYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabase
        .from(SQL_DB_TABLE.youtube_videos)
        .update(logUpdate)
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .select() // 영향 받은 row 확인을 위해 select 필요
        .overrideTypes<TYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          error.message ||
            "#2 Youtube 비디오 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
        );
      }
      throw new Error(
        "#3 Youtube 비디오 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 트랜스크립트 정보 삭제 기능
   * @param videoId 비디오 아이디
   * @returns Youtube 비디오 정보
   */
  static async deleteDetailByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TYoutubeVideoDetail[]>> {
    try {
      const { data, error } = await supabase
        .from(SQL_DB_TABLE.youtube_videos)
        .delete()
        .eq(F_YOUTUBE_VIDEO.video_id.id, videoId)
        .select() // 삭제된 행 유무 확인용
        .overrideTypes<TYoutubeVideoDetail[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(
          error.message ||
            "#2 Youtube 비디오 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
        );
      }
      throw new Error(
        "#3 Youtube 비디오 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}
