import { TYouTubeTranscriptSegment } from "aiqna_common_v1";


/**
 * Embedding Provider 인터페이스
 */ 
export interface IEmbeddingProvider {
  generateEmbedding(text: string, model?: string): Promise<number[]>;
  getDefaultModel(): string;
  getDimensions(model?: string): number;
}

/**
 * Embedding Provider Factory
 */
export type TEmbeddingProviderType =
  | "openai"
  | "cohere"
  | "voyage"
  | "huggingface"
  | "jina";

/**
 * YouTube 자막 트랙 정보를 나타내는 인터페이스
 * YouTube API에서 제공하는 자막 메타데이터
 * 
 * @example
 * {
 *   language_code: "ko",
 *   base_url: "https://www.youtube.com/api/timedtext?v=...",
 *   name: { text: "한국어" },
 *   vss_id: "a.ko",
 *   is_translatable: true
 * }
 */
export type TYouTubeVideoCaptionTrack = {
  language_code?: string;        // 언어 코드 (예: 'ko', 'en', 'ja')
  base_url?: string;             // 자막 다운로드 URL (XML 형식)
  name?: {
    text?: string;               // 언어 표시명 (예: "한국어", "English")
  };
  vss_id?: string;               // 자막 트랙 고유 ID
  is_translatable?: boolean;     // 자동 번역 가능 여부
}

/**
 * YouTube 비디오의 자막 데이터 구조
 * 
 * @example
 * {
 *   caption_tracks: [
 *     { language_code: "ko", base_url: "...", name: { text: "한국어" } },
 *     { language_code: "en", base_url: "...", name: { text: "English" } },
 *     { language_code: "ja", base_url: "...", name: { text: "日本語" } }
 *   ]
 * }
 */
export type TYouTubeVideoCaptionsAvailable = {
  caption_tracks?: TYouTubeVideoCaptionTrack[];  // 사용 가능한 모든 자막 트랙 목록
}

/**
 * Extracted Content(YouTube Video, Instagram Post) Metadata
 */
export type TAnalyzedContentMetadata = {
  categories: string[];
  keywords: string[];
  locations: string[];
  names: string[];
  confidence_score: number;
};



/**
 * YouTube 비디오 자막 데이터
 * innertubeClient 로 가져온 XML 파싱 결과
 */
export type TXMLParsedYouTubeTranscript = {
  videoTitle: string;
  language: string;
  transcriptSegments: TYouTubeTranscriptSegment[];
  availableLanguages?: string[];
}



export type TInstagramPostHTMLMetadata = {
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_url?: string | null;
  og_ios_url?: string | null;
  og_android_package?: string | null;
  og_android_url?: string | null;
  local_image_url?: string | null;
}
