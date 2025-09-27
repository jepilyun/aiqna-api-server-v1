import { TYouTubeTranscriptSegment } from 'aiqna_common_v1';
import Innertube from 'youtubei.js';
import { sleep } from '../utils/sleep.js';

/**
 * 자막 트랙 타입 정의
 */
interface CaptionTrack {
  language_code?: string;
  base_url?: string;
  name?: {
    text?: string;
  };
  vss_id?: string;
  is_translatable?: boolean;
}

interface CaptionsData {
  caption_tracks?: CaptionTrack[];
}

/**
 * 재시도 가능한 fetch 함수
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000) // 10초 타임아웃
      });

      // Rate Limit 체크
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : retryDelay * Math.pow(2, attempt); // 지수 백오프
        
        if (attempt < maxRetries) {
          console.log(`Rate limited. Retrying after ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
        throw new Error('Rate limit exceeded after max retries');
      }

      // 서버 에러 재시도
      if (response.status >= 500 && attempt < maxRetries) {
        console.log(`Server error ${response.status}. Retry ${attempt + 1}/${maxRetries}...`);
        await sleep(retryDelay * Math.pow(2, attempt));
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response;

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable = 
        error instanceof TypeError || // 네트워크 오류
        (error as Error).message.includes('timeout') ||
        (error as Error).message.includes('ECONNRESET');

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      console.log(`Network error. Retry ${attempt + 1}/${maxRetries}...`);
      await sleep(retryDelay * Math.pow(2, attempt));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * 특정 언어의 YouTube 트랜스크립트를 가져옵니다.
 * 
 * @param videoId - YouTube 비디오 ID
 * @param targetLanguage - 가져올 언어 코드 (예: 'ko', 'en', 'ja')
 * @returns 비디오 제목, 실제 언어, 트랜스크립트 세그먼트
 */
export async function fetchYoutubeVideoTranscriptByLanguage(
  videoId: string,
  targetLanguage?: string
): Promise<{ 
  videoTitle: string; 
  language: string;
  transcript: TYouTubeTranscriptSegment[];
  availableLanguages?: string[];
}> {
  try {
    console.log(`Fetching transcript for video: ${videoId}, language: ${targetLanguage || 'auto'}`);
    
    const youtube = await Innertube.create({
      cache: undefined,
      generate_session_locally: true
    });
    
    const info = await youtube.getInfo(videoId);
    const videoTitle = info.basic_info?.title || 'Untitled Video';
    
    const basicInfo = info.basic_info as Record<string, unknown>;
    const captions = info.captions as unknown as CaptionsData;
    const availableLanguages: string[] = [];
    
    if (captions?.caption_tracks) {
      for (const track of captions.caption_tracks) {
        if (track.language_code) {
          availableLanguages.push(track.language_code);
        }
      }
      console.log(`Available languages: ${availableLanguages.join(', ')}`);
    }
    
    let transcriptData;
    let actualLanguage = targetLanguage;
    
    if (targetLanguage && captions?.caption_tracks) {
      const targetTrack = captions.caption_tracks.find(
        (track: CaptionTrack) => track.language_code === targetLanguage
      );
      
      if (targetTrack && targetTrack.base_url) {
        try {
          // 재시도 로직 적용
          const response = await fetchWithRetry(targetTrack.base_url, {}, 3, 1000);
          const transcriptText = await response.text();
          
          const segments = parseTranscriptFromUrl(transcriptText);
          
          return {
            videoTitle,
            language: targetLanguage,
            transcript: segments,
            availableLanguages
          };
        } catch (fetchError) {
          console.error(`Failed to fetch transcript URL after retries:`, fetchError);
          throw new Error(
            `Transcript fetch failed for ${targetLanguage}: ${(fetchError as Error).message}`
          );
        }
      } else {
        throw new Error(`Transcript not available in language: ${targetLanguage}`);
      }
    } else {
      // 기본 트랜스크립트
      transcriptData = await info.getTranscript();
      actualLanguage = 
        (basicInfo?.default_language as string) || 
        (basicInfo?.defaultLanguage as string) || 
        (basicInfo?.default_audio_language as string) || 
        (basicInfo?.defaultAudioLanguage as string) ||
        (availableLanguages.length > 0 ? availableLanguages[0] : undefined) ||
        'en';
    }
    
    // 기존 파싱 로직...
    const transcriptObj = transcriptData as unknown as {
      transcript?: { content?: { body?: { initial_segments?: unknown[] } } };
      content?: { body?: { initial_segments?: unknown[] } };
      body?: { initial_segments?: unknown[] };
    };
    
    const segments = 
      transcriptObj.transcript?.content?.body?.initial_segments ||
      transcriptObj.content?.body?.initial_segments ||
      transcriptObj.body?.initial_segments ||
      [];
    
    const transcript: TYouTubeTranscriptSegment[] = segments
      .map((seg: unknown) => {
        const segment = seg as {
          snippet?: { text?: string };
          text?: string;
          start_ms?: string;
          end_ms?: string;
        };
        
        const text = segment.snippet?.text || segment.text || '';
        const startMs = segment.start_ms || '0';
        const endMs = segment.end_ms || '0';
        
        return {
          transcript_segment_renderer: {
            snippet: { text },
            start_ms: startMs,
            end_ms: endMs
          }
        };
      })
      .filter((s: TYouTubeTranscriptSegment) => 
        s.transcript_segment_renderer.snippet?.text
      );

    return { 
      videoTitle, 
      language: actualLanguage || 'unknown',
      transcript,
      availableLanguages
    };
    
  } catch (error) {
    console.error(`Error fetching transcript (${targetLanguage}):`, error);
    throw error;
  }
}

// XML 파싱 함수 추가
function parseTranscriptFromUrl(xmlText: string): TYouTubeTranscriptSegment[] {
  const segments: TYouTubeTranscriptSegment[] = [];
  const textMatches = xmlText.matchAll(/<text start="([^"]+)" dur="([^"]+)"[^>]*>([^<]+)<\/text>/g);
  
  for (const match of textMatches) {
    const startSec = parseFloat(match[1]);
    const durationSec = parseFloat(match[2]);
    const startMs = startSec * 1000;
    const endMs = (startSec + durationSec) * 1000;
    
    // HTML 엔티티 디코딩
    const text = match[3]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    segments.push({
      transcript_segment_renderer: {
        snippet: { text },
        start_ms: String(startMs),
        end_ms: String(endMs)
      }
    });
  }
  
  return segments;
}
