import DBSqlProcessingLogYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";
import {
  TSqlYoutubeVideoProcessingLog,
  EProcessingStatusType,
  ERequestCreateContentType,
  TYouTubeTranscriptStandardFormat,
  TPineconeVectorMetadataForContent,
  TSqlYoutubeVideoDetail,
  TYouTubeVideoSummary,
} from "aiqna_common_v1";
import { handleProcessingError } from "../../content/content-common/handle-processing-error.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { saveYouTubeTranscriptsToPineconeWithProviders } from "../../content/content-youtube-video/save-youtube-transcripts-to-pinecone.js";
import { saveYouTubeTranscriptsToDb } from "../../content/content-youtube-video/save-youtube-transcripts-to-db.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "../../content/content-youtube-video/convert-youtube-transcript-segments-to-standard.js";
import DBSqlYoutubeVideoTranscript from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video-transcript.js";
import { summarizeYouTubeTranscript } from "../../content/content-youtube-video/summarize-youtube-transcript.js";
import { sleep } from "../../utils/sleep.js";


/**
 * YouTubeRateLimiter
 * YouTube 비디오 처리 레이트 리미터
 */
class YouTubeRateLimiter {
  private processedCount = 0;
  private batchLimit: number;
  private isResting = false;

  constructor() {
    // 10~15회 사이 랜덤 배치 크기
    this.batchLimit = this.getRandomInt(10, 15);
    console.log(`📊 Batch limit set to: ${this.batchLimit}`);
  }

  /**
   * 요청 간 대기 시간 (60~300초)
   */
  getNextDelay(): number {
    return this.getRandomInt(60, 300) * 1000; // ms 단위
  }

  /**
   * 배치 완료 후 휴식 시간 (20~40분)
   */
  getRestTime(): number {
    return this.getRandomInt(20, 40) * 60 * 1000; // ms 단위
  }

  /**
   * 처리 카운트 증가
   */
  incrementProcessed(): void {
    this.processedCount++;
    console.log(`📈 Processed: ${this.processedCount}/${this.batchLimit}`);

    if (this.processedCount >= this.batchLimit) {
      this.isResting = true;
      console.log(`🛑 Batch completed! Time for a long rest...`);
    }
  }

  /**
   * 휴식이 필요한지 확인
   */
  shouldRest(): boolean {
    return this.isResting;
  }

  /**
   * 배치 리셋
   */
  resetBatch(): void {
    this.processedCount = 0;
    this.batchLimit = this.getRandomInt(10, 15);
    this.isResting = false;
    console.log(`🔄 Batch reset! New limit: ${this.batchLimit}`);
  }

  /**
   * min ~ max 사이 랜덤 정수
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

/**
 * YouTubeRateLimiter
 * YouTube 비디오 처리 레이트 리미터
 */
const rateLimiter = new YouTubeRateLimiter();

/**
 * YouTube Video Processing Worker
 * 백그라운드에서 지속적으로 대기 중인 작업 처리
 */
export async function startYouTubeVideoWorker() {
  console.log("🚀 YouTube Video Worker started");

  while (true) {
    try {
      // Rate Limiter 확인 (쉬는 시간이면 대기)
      if (rateLimiter.shouldRest()) {
        const restTime = rateLimiter.getRestTime();
        console.log(`😴 Worker resting for ${restTime}ms (${(restTime / 60000).toFixed(1)} minutes)`);
        await sleep(restTime);
        rateLimiter.resetBatch();
        continue;
      }

      // 1. 처리할 작업 가져오기
      const job = await getNextPendingJob();
      
      if (!job) {
        console.log("⏳ No pending jobs, waiting...");
        await sleep(600000); // 600초(10분) 대기
        continue;
      }

      // 2. 작업 처리
      console.log(`\n🎬 Processing video: ${job.video_id}`);
      await processYouTubeVideoJob(job);

      // 3. Rate Limiting 적용
      rateLimiter.incrementProcessed();
      const delay = rateLimiter.getNextDelay();
      console.log(`⏱️  Waiting ${delay}ms before next request...`);
      await sleep(delay);

    } catch (error) {
      console.error("❌ Worker error:", error);
      await sleep(30000); // 에러 시 30초 대기
    }
  }
}

/**
 * 다음 처리할 작업 가져오기
 * is_transcript_exist=true AND is_transcript_fetched=false
 * 가장 오래된 것부터
 */
async function getNextPendingJob(): Promise<TSqlYoutubeVideoProcessingLog | null> {
  const result = await DBSqlProcessingLogYoutubeVideo.selectPendingJobs({
    limit: 1,
    orderBy: 'created_at', // 가장 오래된 것부터
  });

  return result.data?.[0] || null;
}

/**
 * 개별 작업 처리
 */
async function processYouTubeVideoJob(
  job: TSqlYoutubeVideoProcessingLog
): Promise<void> {
  const { video_id } = job;
  let aiSummary: TYouTubeVideoSummary | null = null;

  try {
    // 상태를 'processing'으로 변경
    await DBSqlProcessingLogYoutubeVideo.updateByVideoId(video_id, {
      processing_status: EProcessingStatusType.processing,
      processing_started: new Date().toISOString(),
    });

    // 1. Video Data 가져오기
    const videoDataResult = await DBSqlYoutubeVideo.selectByVideoId(video_id);
    const videoData = videoDataResult.data?.[0];
    
    if (!videoData) {
      throw new Error(`Video data not found for ${video_id}`);
    }

    // 2. Transcript 가져오기
    const transcripts = await processYouTubeVideoTranscripts(video_id, job);

    // 3. 🆕 AI 요약 생성 (영어 자막 기준)
    if (transcripts.length > 0) {
      const englishTranscript = transcripts.find(t => 
        t.language === 'en' || t.language.startsWith('en-')
      );
      
      if (englishTranscript) {
        console.log('🤖 Generating AI summary with Groq...');
        
        const fullText = englishTranscript.segments
          .map(s => s.text)
          .join(' ');
        
        const videoTitle = videoData.title || '';
        
        aiSummary = await summarizeYouTubeTranscript(
          fullText,
          videoTitle,
          englishTranscript.language
        );
        
        // 4. DB에 요약 저장
        await DBSqlYoutubeVideo.updateSummaryByVideoId(video_id, {
          ai_summary: aiSummary.summary,
          main_topics: aiSummary.mainTopics,
          key_points: aiSummary.keyPoints,
          keywords: aiSummary.keywords,
        });
        
        console.log('✅ AI summary saved to DB');
      } else {
        console.warn('⚠️ No English transcript available for summary');
      }
    }

    // 5. Pinecone 저장 (요약 포함)
    if (transcripts.length > 0 && videoData) {
      await processYouTubeVideoToPinecone(
        video_id,
        { 
          ...videoData,
          ai_summary: aiSummary?.summary || "",
          main_topics: aiSummary?.mainTopics || [],
          key_points: aiSummary?.keyPoints || [],
          keywords: aiSummary?.keywords || [],
        },
        transcripts,
        job,
      );
    }

    console.log(`✅ Job completed: ${video_id}`);
  } catch (error) {
    console.error(`❌ Job failed: ${video_id}`, error);
    
    await handleProcessingError(
      ERequestCreateContentType.YoutubeVideo,
      video_id,
      error,
      job.retry_count || 0,
    );
  }
}

/**
 * 트랜스크립트 처리
 * YouTube 자막 가져오기 및 DB 저장
 */
async function processYouTubeVideoTranscripts(
  videoId: string,
  log?: TSqlYoutubeVideoProcessingLog,
): Promise<TYouTubeTranscriptStandardFormat[]> {
  // 이미 처리된 경우 DB에서 조회
  if (log?.is_transcript_fetched) {
    console.log("✅ Transcripts already fetched, loading from DB...");
    const transcripts = await loadExistingTranscripts(videoId);
    console.log(`✅ Loaded ${transcripts.length} transcripts from DB`);
    return transcripts;
  }

  // 트랜스크립트가 없으면 새로 가져오기
  console.log("📥 Fetching YouTube transcripts...");

  return await withRetry(
    async () => {
      const transcripts = await saveYouTubeTranscriptsToDb(
        videoId,
        ["en", "ko"],
        '../data/transcripts', // ✅ 로컬 캐시 경로 명시
      );
      
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
        is_transcript_fetched: true,
        is_transcript_exist: transcripts.length > 0, // 👈 추가
      });

      console.log(`✅ Saved ${transcripts.length} transcripts`);
      return transcripts;
    },
    {
      maxRetries: 3,
      baseDelay: 100000, // 100초 자막은 더 보수적으로
      operationName: "Fetch YouTube transcripts",
    }
  );
}

/**
 * Load Existing Transcripts from DB
 */
async function loadExistingTranscripts(
  videoId: string,
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const existingTranscripts =
    await DBSqlYoutubeVideoTranscript.selectByVideoId(videoId);

  if (!existingTranscripts.data?.length) {
    console.warn(`⚠️ No transcripts found in DB for video ${videoId}`);
    return [];
  }

  const transcripts =
    existingTranscripts.data
      .map((t) => {
        if (!t.segments_json) {
          console.warn(`⚠️ No segments_json for ${t.language}`);
          return null;
        }

        // 타입 체크 후 처리
        let parsedSegments;

        if (typeof t.segments_json === "string") {
          try {
            parsedSegments = JSON.parse(t.segments_json);
          } catch (error) {
            console.error(
              `❌ Failed to parse segments_json for ${t.language}:`,
              error,
            );
            return null;
          }
        } else {
          parsedSegments = t.segments_json;
        }

        const segments =
          convertYouTubeTranscriptSegmentsToStandard(parsedSegments);

        return {
          videoId,
          language: t.language,
          segments,
        };
      })
      .filter((t): t is TYouTubeTranscriptStandardFormat => t !== null);

  return transcripts;
}


/**
 * 3. Pinecone 처리
 * 비디오 메타데이터와 자막을 벡터화하여 Pinecone에 저장
 */
async function processYouTubeVideoToPinecone(
  videoId: string,
  videoData: TSqlYoutubeVideoDetail,
  transcripts: TYouTubeTranscriptStandardFormat[],
  log?: TSqlYoutubeVideoProcessingLog,
): Promise<void> {
  // 이미 처리되었거나 자막이 없으면 스킵
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  if (transcripts.length === 0) {
    console.warn("⚠️ No transcripts available, skipping Pinecone processing");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = convertYouTubeApiDataToPineconeVideoMetadata(videoData);

      await saveYouTubeTranscriptsToPineconeWithProviders(
        transcripts,
        metadata,
      );
      
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(videoId, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed, // ✅ enum 사용
      });

      console.log("✅ Pinecone processing completed");
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Pinecone processing",
    }
  );
}

/**
 * Convert YouTube API Data to Pinecone Metadata
 */
function convertYouTubeApiDataToPineconeVideoMetadata(
  videoData: TSqlYoutubeVideoDetail,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    video_id: videoData.video_id || "",
    title: videoData.title || "",
    channel_title: videoData.channel_name || "",
    channel_id: videoData.channel_id || "",
    published_date: videoData.published_date || "",
    thumbnail_url: videoData.thumbnail_url || "",
    duration: videoData.duration_seconds.toString(),
    view_count: videoData.view_count,
    like_count: videoData.like_count,
    ai_summary: videoData.ai_summary || "",
    main_topics: videoData.main_topics || [],
    key_points: videoData.key_points || [],
    keywords: videoData.keywords || [],
  };
}
