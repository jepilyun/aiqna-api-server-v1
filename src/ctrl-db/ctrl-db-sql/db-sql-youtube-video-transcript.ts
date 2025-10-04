import {
  F_YOUTUBE_VIDEO_TRANSCRIPT,
  LIST_LIMIT,
  ResponseDBSelect,
  SQL_DB_TABLE,
  TSqlYoutubeVideoTranscript,
  TSqlYoutubeVideoTranscriptInsert,
  TSqlYoutubeVideoTranscriptUpdate,
} from "aiqna_common_v1";
import supabaseClient from "../../config/supabase-client.js";
import { ErrorYoutubeVideoTranscriptDuplicate } from "../../errors/error-youtube-video-transcript.js";

/**
 * DBSqlYoutubeVideoTranscript
 * Youtube 비디오 트랜스크립트 관련 데이터베이스 작업을 수행하는 클래스
 * Youtube 비디오 트랜스크립트 등록, 조회, 수정, 삭제 기능 제공
 */
export default class DBSqlYoutubeVideoTranscript {
  /**
   * Youtube 비디오 트랜스크립트 목록 조회
   * @param start 시작 인덱스
   * @param limit 조회할 개수
   * @returns Youtube 비디오 트랜스크립트 목록과 총 개수
   */
  static async selectList(
    start: number = LIST_LIMIT.start,
    limit: number = LIST_LIMIT.default,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .select("*", { count: "exact" })
        .order(F_YOUTUBE_VIDEO_TRANSCRIPT.created_at.id, { ascending: false })
        .range(start, start + limit - 1)
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 목록 조회(SELECT LIST) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 목록 조회(SELECT LIST) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * video_id로 Youtube 비디오 트랜스크립트 조회
   * @param videoId 비디오 아이디
   * @returns Youtube 비디오 트랜스크립트 목록과 총 개수
   */
  static async selectByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .select("*", { count: "exact" })
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.video_id.id, videoId)
        .order(F_YOUTUBE_VIDEO_TRANSCRIPT.created_at.id, { ascending: true })
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 조회(SELECT By VideoId) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 조회(SELECT By VideoId) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * video_id와 language로 Youtube 비디오 트랜스크립트 조회
   * @param videoId 비디오 아이디
   * @param language 언어 코드 (예: 'ko', 'en')
   * @returns Youtube 비디오 트랜스크립트 정보
   */
  static async selectByVideoIdAndLanguage(
    videoId: string,
    language: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error, count } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .select("*", { count: "exact" })
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.video_id.id, videoId)
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.language.id, language)
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 조회(SELECT By VideoId & Language) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [], count: count || 0 };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 조회(SELECT By VideoId & Language) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 트랜스크립트 등록 기능
   * @param log Youtube 비디오 트랜스크립트 정보
   * @returns Youtube 비디오 트랜스크립트 정보
   */
  static async insert(
    log: TSqlYoutubeVideoTranscriptInsert,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .insert(log)
        .select()
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        if (error.code === "23505") {
          // UNIQUE 제약 위반
          throw new ErrorYoutubeVideoTranscriptDuplicate(log.video_id);
        } else {
          throw new Error(
            `#1 Youtube 비디오 트랜스크립트 등록(INSERT) 중 오류 발생 >>> ${error.message}`,
          );
        }
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 등록(INSERT) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 트랜스크립트 등록/수정 기능 (upsert)
   * video_id와 language 조합이 이미 존재하면 업데이트, 없으면 새로 등록
   * @param log Youtube 비디오 트랜스크립트 정보
   * @returns Youtube 비디오 트랜스크립트 정보
   */
  static async upsert(
    log: TSqlYoutubeVideoTranscriptInsert,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .upsert(log, {
          onConflict: 'video_id,language',
          ignoreDuplicates: false
        })
        .select()
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 Upsert 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 Upsert 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 트랜스크립트 수정 기능
   * @param videoId 비디오 아이디
   * @param logUpdate Youtube 비디오 트랜스크립트 수정 정보
   * @returns Youtube 비디오 트랜스크립트 정보
   */
  static async updateByVideoId(
    videoId: string,
    logUpdate: TSqlYoutubeVideoTranscriptUpdate,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .update(logUpdate)
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 정보 수정(UPDATE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 정보 수정(UPDATE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * Youtube 비디오 트랜스크립트 삭제 기능
   * @param videoId 비디오 아이디
   * @returns 삭제된 Youtube 비디오 트랜스크립트 정보
   */
  static async deleteByVideoId(
    videoId: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .delete()
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.video_id.id, videoId)
        .select()
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 정보 삭제(DELETE) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 정보 삭제(DELETE) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }

  /**
   * 특정 video_id와 language의 트랜스크립트 삭제
   * @param videoId 비디오 아이디
   * @param language 언어 코드
   * @returns 삭제된 Youtube 비디오 트랜스크립트 정보
   */
  static async deleteByVideoIdAndLanguage(
    videoId: string,
    language: string,
  ): Promise<ResponseDBSelect<TSqlYoutubeVideoTranscript[]>> {
    try {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_video_transcripts)
        .delete()
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.video_id.id, videoId)
        .eq(F_YOUTUBE_VIDEO_TRANSCRIPT.language.id, language)
        .select()
        .overrideTypes<TSqlYoutubeVideoTranscript[]>();

      if (error) {
        throw new Error(
          `#1 Youtube 비디오 트랜스크립트 정보 삭제(DELETE By Language) 중 오류 발생 >>> ${error.message}`,
        );
      }

      return { data: data || [] };
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        "#3 Youtube 비디오 트랜스크립트 정보 삭제(DELETE By Language) 중 알 수 없는 오류가 발생했습니다.",
      );
    }
  }
}