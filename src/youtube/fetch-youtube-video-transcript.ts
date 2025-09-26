import { TYouTubeTranscriptSegment } from 'aiqna_common_v1';
import Innertube from 'youtubei.js';

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
    
    // ✅ 여기에 추가
    if (targetLanguage && captions?.caption_tracks) {
      const targetTrack = captions.caption_tracks.find(
        (track: CaptionTrack) => track.language_code === targetLanguage
      );
      
      if (targetTrack && targetTrack.base_url) {
        // base_url에서 직접 자막 데이터 가져오기
        const response = await fetch(targetTrack.base_url);
        const transcriptText = await response.text();
        
        // XML 파싱
        const segments = parseTranscriptFromUrl(transcriptText);
        
        return {
          videoTitle,
          language: targetLanguage,
          transcript: segments,
          availableLanguages
        };
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
    
    // 기존 파싱 로직 (기본 트랜스크립트용)
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

// /**
//  * 여러 언어의 트랜스크립트를 저장합니다.
//  * 
//  * @param videoId - YouTube 비디오 ID
//  * @param languages - 시도할 언어 목록 (기본값: ['ko', 'en'])
//  */
// export async function saveMultipleLanguageTranscripts(
//   videoId: string,
//   languages: string[] = ['ko', 'en']
// ): Promise<{
//   saved: string[];
//   failed: string[];
// }> {
//   const saved: string[] = [];
//   const failed: string[] = [];
  
//   for (const lang of languages) {
//     try {
//       // 각 언어별로 트랜스크립트 가져오기
//       const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(videoId, lang);
      
//       // 실제 반환된 언어가 요청한 언어와 다를 수 있음
//       if (transcriptResult.language !== lang) {
//         console.log(`Requested ${lang} but got ${transcriptResult.language}`);
//       }
      
//       const transcriptData = transformTranscriptForDB(
//         videoId, 
//         transcriptResult,
//         transcriptResult.language // 실제 언어 사용
//       );
      
//       // UNIQUE(video_id, language) 제약 덕분에 중복 저장 방지
//       await YourClass.insert(transcriptData);
      
//       saved.push(transcriptResult.language);
//       console.log(`✓ ${transcriptResult.language} 트랜스크립트 저장 완료`);
      
//     } catch (error) {
//       failed.push(lang);
//       console.log(`✗ ${lang} 트랜스크립트 없음:`, error instanceof Error ? error.message : error);
//       continue;
//     }
//   }
  
//   return { saved, failed };
// }

// /**
//  * 사용 가능한 모든 언어의 트랜스크립트를 저장합니다.
//  * 
//  * @param videoId - YouTube 비디오 ID
//  */
// export async function saveAllAvailableTranscripts(videoId: string) {
//   try {
//     // 먼저 사용 가능한 언어 확인
//     const result = await fetchYoutubeVideoTranscriptByLanguage(videoId);
//     const availableLanguages = result.availableLanguages || [result.language];
    
//     console.log(`Available languages for ${videoId}:`, availableLanguages);
    
//     // 모든 사용 가능한 언어로 저장
//     return await saveMultipleLanguageTranscripts(videoId, availableLanguages);
    
//   } catch (error) {
//     console.error('Error saving transcripts:', error);
//     throw error;
//   }
// }