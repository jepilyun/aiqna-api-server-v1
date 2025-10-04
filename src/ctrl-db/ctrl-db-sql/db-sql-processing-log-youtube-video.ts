import {
  F_YOUTUBE_VIDEO_PROCESSING_LOG,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlYoutubeVideoProcessingLog,
  TSqlYoutubeVideoProcessingLogInsert,
  TSqlYoutubeVideoProcessingLogUpdate,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorYoutubeVideoProcessingLogDuplicate } from "../../errors/error-processing-log-youtube-video.js";

/**
 * DBSqlYoutubeVideoProcessingLog
 * Youtube 비디오 처리 로그 관련 데이터베이스 작업을 수행하는 클래스
 * Youtube 비디오 처리 로그 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlProcessingLogYoutubeVideo {
  /**
   * Youtube 비디오 처리 로그 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Youtube 비디오 처리 로그 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .select("*", { count: "exact" })
        .order(F_YOUTUBE_VIDEO_PROCESSING_LOG.created_at.id, {
          ascending: false,
        })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 처리 로그 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * video_id로 Youtube 비디오 처리 로그 조회
   * @param videoId 비디오 아이디
   * @returns Youtube 비디오 처리 로그 목록과 총 개수
   */
  static async selectByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .select("*", { count: "exact" })
        .order(F_YOUTUBE_VIDEO_PROCESSING_LOG.created_at.id, {
          ascending: true,
        })
        .eq(F_YOUTUBE_VIDEO_PROCESSING_LOG.video_id.id, videoId)
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 처리 로그 조회(SELECT By VideoId) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 조회(SELECT By VideoId) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 처리 로그 등록 기능
   * @param logData Youtube 비디오 처리 로그 정보
   * @returns Youtube 비디오 처리 로그 정보
   */
  static async insert(
    logData: TSqlYoutubeVideoProcessingLogInsert,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    console.log("DEV DBSqlProcessingLogYoutubeVideo: ", logData);
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .insert(logData)
        .select()
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        if (error.code === "23505") {
          // PRIMARY KEY 중복	23505	unique_violation
          throw new ErrorYoutubeVideoProcessingLogDuplicate(logData.video_id);
        } else {
          throw new Error(
            `#1 Youtube 비디오 처리 로그 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 처리 로그 등록/수정 기능 (upsert)
   * video_id가 이미 존재하면 업데이트, 없으면 새로 등록
   * @param logData Youtube 비디오 처리 로그 정보
   * @returns Youtube 비디오 처리 로그 정보
   */
  static async upsert(
    logData: TSqlYoutubeVideoProcessingLogInsert,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .upsert(logData, {
          onConflict: 'video_id',
          ignoreDuplicates: false
        })
        .select()
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 처리 로그 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 처리 로그 수정 기능
   * @param videoId 비디오 아이디
   * @param updateData 수정할 Youtube 비디오 처리 로그 정보
   * @returns Youtube 비디오 처리 로그 정보
   */
  static async updateByVideoId(
    videoId: string,
    updateData: TSqlYoutubeVideoProcessingLogUpdate,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .update(updateData)
        .eq(F_YOUTUBE_VIDEO_PROCESSING_LOG.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 처리 로그 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 처리 로그 삭제 기능
   * @param videoId 비디오 아이디
   * @returns 삭제된 Youtube 비디오 처리 로그 정보
   */
  static async deleteByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoProcessingLog[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_processing_logs)
        .delete()
        .eq(F_YOUTUBE_VIDEO_PROCESSING_LOG.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoProcessingLog[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 처리 로그 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 처리 로그 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}