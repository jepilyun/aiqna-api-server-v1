/**
 * YouTube 관련 유틸리티 클래스
 */
export class YouTubeHelper {
  /**
   * YouTube URL 또는 Video ID에서 11자리 비디오 ID를 추출
   *
   * 지원하는 형식:
   * - 직접 비디오 ID: "dQw4w9WgXcQ"
   * - 일반 YouTube URL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   * - 단축 URL: "https://youtu.be/dQw4w9WgXcQ"
   * - 임베드 URL: "https://www.youtube.com/embed/dQw4w9WgXcQ"
   * - Shorts URL: "https://www.youtube.com/shorts/dQw4w9WgXcQ"
   *
   * @param urlOrId - YouTube URL 또는 비디오 ID 문자열
   * @returns 추출된 11자리 비디오 ID 또는 null (추출 실패 시)
   */
  static extractVideoId(urlOrId: string): string | null {
    // 빈 값이나 null 체크
    if (!urlOrId) return null;

    // 이미 11자리 비디오 ID인지 확인 (URL 특수문자가 없는 경우)
    if (
      urlOrId.length === 11 &&
      !urlOrId.includes("/") &&
      !urlOrId.includes("?")
    ) {
      return urlOrId;
    }

    try {
      // URL 객체로 파싱 시도
      const url = new URL(urlOrId);

      // youtu.be 단축 URL 처리
      // 예: https://youtu.be/dQw4w9WgXcQ
      if (url.hostname === "youtu.be") {
        return url.pathname.substring(1);
      }

      // 일반 YouTube 도메인 처리
      if (
        url.hostname === "www.youtube.com" ||
        url.hostname === "youtube.com"
      ) {
        // 일반 시청 페이지: /watch?v=VIDEO_ID
        if (url.pathname === "/watch") {
          return url.searchParams.get("v");
        }

        // 임베드 URL: /embed/VIDEO_ID
        if (url.pathname.startsWith("/embed/")) {
          return url.pathname.substring("/embed/".length);
        }

        // YouTube Shorts: /shorts/VIDEO_ID
        if (url.pathname.startsWith("/shorts/")) {
          return url.pathname.substring("/shorts/".length);
        }
      }
    } catch (e) {
      // URL 파싱 실패 시 에러 로그 출력
      console.error(
        "Invalid URL or ID format attempting to parse:",
        urlOrId,
        e,
      );
    }

    // 모든 패턴에 매치되지 않거나 에러 발생 시 null 반환
    return null;
  }

  /**
   * Video ID로 YouTube 표준 시청 URL 생성
   * @param videoId - YouTube 비디오 ID
   * @returns YouTube 시청 URL
   */
  static buildWatchUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * Video ID로 YouTube 단축 URL 생성
   * @param videoId - YouTube 비디오 ID
   * @returns YouTube 단축 URL
   */
  static buildShortUrl(videoId: string): string {
    return `https://youtu.be/${videoId}`;
  }

  /**
   * Video ID로 YouTube 임베드 URL 생성
   * @param videoId - YouTube 비디오 ID
   * @returns YouTube 임베드 URL
   */
  static buildEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  /**
   * Video ID로 YouTube Shorts URL 생성
   * @param videoId - YouTube 비디오 ID
   * @returns YouTube Shorts URL
   */
  static buildShortsUrl(videoId: string): string {
    return `https://www.youtube.com/shorts/${videoId}`;
  }

  /**
   * Video ID로 썸네일 URL 생성
   * @param videoId - YouTube 비디오 ID
   * @param quality - 썸네일 품질 ('default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault')
   * @returns 썸네일 이미지 URL
   */
  static getThumbnailUrl(
    videoId: string,
    quality:
      | "default"
      | "mqdefault"
      | "hqdefault"
      | "sddefault"
      | "maxresdefault" = "hqdefault",
  ): string {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }

  /**
   * URL이 유효한 YouTube URL인지 확인
   * @param url - 검증할 URL
   * @returns 유효한 YouTube URL이면 true
   */
  static isValidYouTubeUrl(url: string): boolean {
    return this.extractVideoId(url) !== null;
  }

  /**
   * Video ID가 유효한 형식인지 확인 (11자리 영숫자 및 특정 기호)
   * @param videoId - 검증할 비디오 ID
   * @returns 유효한 형식이면 true
   */
  static isValidVideoId(videoId: string): boolean {
    // YouTube 비디오 ID는 11자리이며 영문자, 숫자, '-', '_'로 구성
    const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
    return videoIdPattern.test(videoId);
  }

  /**
   * YouTube URL에서 타임스탬프 파라미터 추출
   * @param url - YouTube URL
   * @returns 타임스탬프(초) 또는 null
   */
  static extractTimestamp(url: string): number | null {
    try {
      const urlObj = new URL(url);

      // ?t=123 형식
      const tParam = urlObj.searchParams.get("t");
      if (tParam) {
        return parseInt(tParam, 10);
      }

      // ?start=123 형식 (임베드 URL에서 사용)
      const startParam = urlObj.searchParams.get("start");
      if (startParam) {
        return parseInt(startParam, 10);
      }
    } catch (e) {
      console.error("Failed to extract timestamp:", e);
    }

    return null;
  }

  /**
   * Video ID와 타임스탬프로 URL 생성
   * @param videoId - YouTube 비디오 ID
   * @param timestamp - 시작 시간(초)
   * @returns 타임스탬프가 포함된 YouTube URL
   */
  static buildUrlWithTimestamp(videoId: string, timestamp: number): string {
    return `https://www.youtube.com/watch?v=${videoId}&t=${timestamp}`;
  }

  /**
   * 재생목록 ID 추출
   * @param url - YouTube 재생목록 URL
   * @returns 재생목록 ID 또는 null
   */
  static extractPlaylistId(url: string): string | null {
    try {
      const urlObj = new URL(url);

      if (
        urlObj.hostname === "www.youtube.com" ||
        urlObj.hostname === "youtube.com"
      ) {
        // ?list=PLAYLIST_ID 형식
        return urlObj.searchParams.get("list");
      }
    } catch (e) {
      console.error("Failed to extract playlist ID:", e);
    }

    return null;
  }

  /**
   * 채널 ID 또는 채널 이름 추출
   * @param url - YouTube 채널 URL
   * @returns 채널 ID/이름 또는 null
   */
  static extractChannelInfo(
    url: string,
  ): { type: "id" | "name" | "handle"; value: string } | null {
    try {
      const urlObj = new URL(url);

      if (
        urlObj.hostname === "www.youtube.com" ||
        urlObj.hostname === "youtube.com"
      ) {
        // /channel/CHANNEL_ID
        if (urlObj.pathname.startsWith("/channel/")) {
          return {
            type: "id",
            value: urlObj.pathname.substring("/channel/".length).split("/")[0],
          };
        }

        // /c/CHANNEL_NAME (레거시)
        if (urlObj.pathname.startsWith("/c/")) {
          return {
            type: "name",
            value: urlObj.pathname.substring("/c/".length).split("/")[0],
          };
        }

        // /@HANDLE (신규 핸들 시스템)
        if (urlObj.pathname.startsWith("/@")) {
          return {
            type: "handle",
            value: urlObj.pathname.substring(2).split("/")[0],
          };
        }
      }
    } catch (e) {
      console.error("Failed to extract channel info:", e);
    }

    return null;
  }
}

// 하위 호환성을 위한 기존 함수 export (선택사항)
export const extractYouTubeVideoId = YouTubeHelper.extractVideoId;
