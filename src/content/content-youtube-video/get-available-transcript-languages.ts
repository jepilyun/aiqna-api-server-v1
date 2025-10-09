// content/content-youtube-video/get-available-transcript-languages.ts
import { fetchYouTubeTranscriptWithRetry } from "../../utils/retry/retry-fetch-youtube.js";
import { YouTubeHelper } from "./youtube-helper.js";

/**
 * YouTube 비디오의 사용 가능한 자막 언어 목록 가져오기
 * 
 * @param videoId - YouTube 비디오 ID
 * @returns 사용 가능한 언어 코드 배열 (예: ['en-GB', 'ko', 'ja'])
 */
export async function getAvailableTranscriptLanguages(
  videoId: string
): Promise<string[]> {
  try {
    const url = YouTubeHelper.buildWatchUrl(videoId);
    const response = await fetchYouTubeTranscriptWithRetry(url);
    const html = await response.text();

    // captionTracks 정보 추출
    const captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/);
    
    if (!captionTracksMatch) {
      return [];
    }

    const captionTracks = JSON.parse(captionTracksMatch[1]);
    
    // 언어 코드 추출
    const languages = captionTracks
      .map((track: { languageCode?: string }) => track.languageCode)
      .filter((lang: string | undefined): lang is string => !!lang);

    return languages;
  } catch (error) {
    console.error(`Failed to get available languages for ${videoId}:`, error);
    return [];
  }
}