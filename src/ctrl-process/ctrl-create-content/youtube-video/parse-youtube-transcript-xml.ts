import { TYouTubeTranscriptSegment } from "aiqna_common_v1";

/**
 * YouTube 자막 XML을 파싱하여 TYouTubeTranscriptSegment[] 배열로 변환
 * 
 * **역할:**
 * - base_url로 다운로드한 XML 텍스트를 정규식으로 파싱
 * - HTML 엔티티 디코딩 (&amp; → &, &lt; → < 등)
 * - 밀리초 단위로 시간 변환 (초 → ms)
 * 
 * **fetchYoutubeVideoTranscriptByLanguage와의 관계:**
 * ```
 * fetchYoutubeVideoTranscriptByLanguage
 *   ↓ (targetLanguage 지정된 경우)
 * fetchWithRetry(base_url)
 *   ↓ (XML 텍스트 다운로드)
 * parseTranscriptFromUrl(xmlText)  ← 이 함수
 *   ↓ (파싱 완료)
 * TYouTubeTranscriptSegment[] 반환
 * ```
 * 
 * @param xmlText - YouTube 자막 XML 텍스트
 * @returns 파싱된 트랜스크립트 세그먼트 배열
 * 
 * @example
 * // 입력 XML:
 * const xml = `<?xml version="1.0"?>
 * <transcript>
 *   <text start="0" dur="2.5">We&amp;#39;re no strangers to love</text>
 *   <text start="2.5" dur="2.5">You know the rules and so do I</text>
 *   <text start="5.0" dur="3.0">A full commitment&amp;#39;s what I&amp;#39;m thinking of</text>
 * </transcript>`;
 * 
 * const segments = parseTranscriptFromUrl(xml);
 * 
 * // 출력:
 * // [
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "We're no strangers to love" },
 * //       start_ms: "0",       // 0초 * 1000 = 0ms
 * //       end_ms: "2500"       // (0 + 2.5)초 * 1000 = 2500ms
 * //     }
 * //   },
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "You know the rules and so do I" },
 * //       start_ms: "2500",    // 2.5초 * 1000 = 2500ms
 * //       end_ms: "5000"       // (2.5 + 2.5)초 * 1000 = 5000ms
 * //     }
 * //   },
 * //   {
 * //     transcript_segment_renderer: {
 * //       snippet: { text: "A full commitment's what I'm thinking of" },
 * //       start_ms: "5000",
 * //       end_ms: "8000"       // (5 + 3)초 * 1000 = 8000ms
 * //     }
 * //   }
 * // ]
 * 
 * @example
 * // HTML 엔티티 디코딩 예시:
 * // 원본 XML: <text start="10" dur="2">It&amp;#39;s a &amp;quot;great&amp;quot; day</text>
 * // 디코딩 결과: "It's a "great" day"
 * //
 * // 변환 규칙:
 * // &amp;   → &
 * // &lt;    → 
 * // &gt;    → >
 * // &quot;  → "
 * // &#39;   → '
 */
export function parseYouTubeTranscriptXML(xmlText: string): TYouTubeTranscriptSegment[] {
  const segments: TYouTubeTranscriptSegment[] = [];
  
  // 정규식으로 <text> 태그 추출
  // 매칭 예: <text start="0" dur="2.5">Hello world</text>
  // match[1] = "0" (start)
  // match[2] = "2.5" (dur)
  // match[3] = "Hello world" (텍스트 내용)
  const textMatches = xmlText.matchAll(
    /<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g,
  );

  for (const match of textMatches) {
    const startSec = parseFloat(match[1]);         // 시작 시간 (초)
    const durationSec = parseFloat(match[2]);      // 지속 시간 (초)
    const startMs = startSec * 1000;               // 밀리초로 변환
    const endMs = (startSec + durationSec) * 1000; // 종료 시간 계산

    // HTML 엔티티 디코딩
    // YouTube XML에는 특수문자가 인코딩되어 있음
    const text = match[3]
      .replace(/&amp;/g, "&")      // & 복원
      .replace(/&lt;/g, "<")       // < 복원
      .replace(/&gt;/g, ">")       // > 복원
      .replace(/&quot;/g, '"')     // " 복원
      .replace(/&#39;/g, "'");     // ' 복원

    // TYouTubeTranscriptSegment 형식으로 변환
    segments.push({
      transcript_segment_renderer: {
        snippet: { text },
        start_ms: String(startMs),
        end_ms: String(endMs),
      },
    });
  }

  return segments;
}