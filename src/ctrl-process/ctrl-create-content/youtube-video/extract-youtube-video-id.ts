/**
 * YouTube URL 또는 Video ID에서 11자리 비디오 ID를 추출하는 헬퍼 함수
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
export const extractYouTubeVideoId = (urlOrId: string): string | null => {
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
      // pathname에서 첫 번째 '/' 이후의 문자열이 비디오 ID
      return url.pathname.substring(1);
    }

    // 일반 YouTube 도메인 처리
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
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
    console.error("Invalid URL or ID format attempting to parse:", urlOrId, e);
  }

  // 모든 패턴에 매치되지 않거나 에러 발생 시 null 반환
  return null;
};
