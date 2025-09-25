import Innertube from 'youtubei.js';
import { TTranscriptSegment } from '../types/youtube.js';

export async function fetchYoutubeVideoTranscript(
  videoId: string,
): Promise<{ videoTitle: string; transcript: TTranscriptSegment[] }> {
  try {
    console.log(`Fetching transcript for video: ${videoId}`);
    
    const youtube = await Innertube.create({
      cache: undefined,
      generate_session_locally: true
    });
    
    const info = await youtube.getInfo(videoId);
    const videoTitle = info.basic_info?.title || 'Untitled Video';
    
    const transcriptData = await info.getTranscript();
    
    // unknown 타입 사용
    const transcriptObj = transcriptData as unknown as {
      transcript?: { content?: { body?: { initial_segments?: unknown[] } } };
      content?: { body?: { initial_segments?: unknown[] } };
      body?: { initial_segments?: unknown[] };
    };
    
    // 실제 데이터 구조 확인
    console.log('Transcript data structure:', JSON.stringify(transcriptData, null, 2));
    
    // 여러 가능한 경로 시도
    const segments = 
      transcriptObj.transcript?.content?.body?.initial_segments ||
      transcriptObj.content?.body?.initial_segments ||
      transcriptObj.body?.initial_segments ||
      [];
    
    console.log(`Found ${segments.length} raw segments`);
    
    const transcript: TTranscriptSegment[] = segments
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
      .filter((s: TTranscriptSegment) => 
        s.transcript_segment_renderer.snippet?.text
      );

    console.log(`Processed ${transcript.length} transcript segments`);

    return { videoTitle, transcript };
    
  } catch (error) {
    console.error("Error fetching video transcript:", error);
    throw error;
  }
}