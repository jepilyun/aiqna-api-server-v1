import DBSqlProcessingLogYoutubeVideo from "../db-ctrl/db-ctrl-sql/db-sql-processing-log-youtube-video.js";
import {
  TSqlProcessingLogYoutubeVideo,
  TYouTubeTranscriptStandardFormat,
  TSqlYoutubeVideoDetail,
  IPineconeVectorMetadataForVideo,
} from "aiqna_common_v1";
import { handleProcessingError } from "../services/handle-processing-error.js";
import { withRetry } from "../utils/retry/retry-common.js";
import { saveYouTubeTranscriptsToPinecone } from "../services/youtube-video/save-youtube-transcripts-to-pinecone.js";
import { getYouTubeTranscriptsFromStorageOrYouTubeServer } from "../services/youtube-video/get-youtube-transcripts-from-storage.js";
import { sleep } from "../utils/sleep.js";
import { RateLimiterWorkerYouTubeVideo } from "./rate-limiter-worker-youtube-video.js";
import { EProcessingStatusType } from "../consts/const.js";
import { ERequestCreateContentType } from "../consts/const.js";
import { fetchYouTubeVideoDataFromDB } from "../services/youtube-video/fetch-youtube-video-data-from-db.js";


/**
 * YouTube 비디오 처리 레이트 리미터
 * 한번 처리하고 특정 시간 대기하고 다시 처리
 */
const rateLimiter = new RateLimiterWorkerYouTubeVideo();

/**
 * YouTube Video Processing Worker
 * 백그라운드에서 지속적으로 대기 중인 작업 처리
 */
export async function workerStartYouTubeVideo() {
  console.log("🚀 Worker Started: YouTube Video");

  while (true) {
    try {
      // Rate Limiter Check (Rest Time) - 배치 완료 후 휴식
      if (rateLimiter.shouldRest()) {
        const restTime = rateLimiter.getRestTime();
        console.log(
          `😴 Worker resting for ${restTime}ms (${(restTime / 60000).toFixed(1)} minutes)`,
        );
        await sleep(restTime);
        rateLimiter.resetBatch();
        continue;
      }

      // 1. 처리할 작업 1개 가져오기
      const resultPendingJobs =
        await DBSqlProcessingLogYoutubeVideo.selectPendingJobs({
          limit: 1,
          orderBy: "created_at",
        });

      const job = resultPendingJobs.data?.[0] || null;

      if (!job) {
        console.log("⏳ No pending jobs, waiting...", new Date().toISOString());
        await sleep(1200000);
        continue;
      }

      console.log(`\n🎬 Processing video: ${job.video_id}`);

      // 자막이 없는 동영상인지 먼저 체크
      if (job.is_transcript_exist === false) {
        console.log(
          `⏭️ ${job.video_id}: transcript marked ABSENT; skipping transcript/pinecone steps.`,
        );
        await DBSqlProcessingLogYoutubeVideo.updateByVideoId(job.video_id, {
          processing_status: EProcessingStatusType.completed,
          last_processed_at: new Date().toISOString(),
        });
        continue;
      }

      // 3. Fetch YouTube Video Data from DB
      const videoData = await fetchYouTubeVideoDataFromDB(job.video_id);

      if (!videoData) {
        console.error(`❌ Video data not found for ${job.video_id}`);
        continue;
      }

      // 4. Get Transcripts from Storage (✅ 소스 정보 포함)
      const { transcripts, source, youtubeApiCallCount } = 
        await getYouTubeTranscriptsFromStorageOrYouTubeServer(
          job.video_id,
          ["en", "ko"],
          "raw",
          "../data/transcripts",
        );
      
      if (transcripts.length === 0) {
        console.error(`❌ No transcripts found for ${job.video_id}`);
        await DBSqlProcessingLogYoutubeVideo.updateByVideoId(job.video_id, {
          processing_status: EProcessingStatusType.completed,
          is_transcript_exist: false,
          last_processed_at: new Date().toISOString(),
        });
        continue;
      }

      // 존재/가져옴 상태를 정확히 반영
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(job.video_id, {
        is_transcript_exist: transcripts.length > 0,
        is_transcript_fetched: transcripts.length > 0,
        last_processed_at: new Date().toISOString(),
      });

      // 5. Save Transcripts to Pinecone
      await saveTranscriptsToPinecone(
        job.video_id,
        transcripts,
        videoData,
        job,
      );

      // 6. ✅ YouTube API 호출 여부에 따라 Rate Limiting 적용
      if (source === 'youtube') {
        rateLimiter.incrementProcessed();
        const delay = rateLimiter.getNextDelay();
        console.log(
          `⏱️  [YOUTUBE API] Called ${youtubeApiCallCount} time(s). ` +
          `Waiting ${delay}ms (${(delay / 1000).toFixed(0)}s) before next request...`
        );
        await sleep(delay);
      } else {
        console.log(
          `⚡ [CACHE HIT] All transcripts from cache. No rate limit delay needed.`
        );
        // 캐시 히트 시 짧은 딜레이만 (CPU 부하 방지)
        await sleep(100);
      }

    } catch (error) {
      console.error("❌ Worker error:", error);
      await sleep(30000);
    }
  }
}

/**
 * 개별 작업 처리
 */
async function saveTranscriptsToPinecone(
  videoId: string,
  transcripts: TYouTubeTranscriptStandardFormat[],
  videoData: TSqlYoutubeVideoDetail,
  log?: TSqlProcessingLogYoutubeVideo,
): Promise<void> {
  try {
    if (transcripts.length > 0 && videoData) {
      if (log?.is_pinecone_processed) {
        console.log("✅ Already processed to Pinecone");
        return;
      }

      if (transcripts.length === 0) {
        console.warn(
          "⚠️ No transcripts available, skipping Pinecone processing",
        );
        return;
      }

      console.log("📤 Processing to Pinecone...");

      await withRetry(
        async () => {
          const metadata: Partial<IPineconeVectorMetadataForVideo> = {
            video_id: videoData.video_id || "",
            title: videoData.title || "",
            channel_title: videoData.channel_name || "",
            channel_id: videoData.channel_id || "",
            published_date: videoData.published_date || "",
            thumbnail_url: videoData.thumbnail_url || "",
            duration: videoData.duration_seconds.toString(),
            view_count: videoData.view_count,
            like_count: videoData.like_count,
          };

          await saveYouTubeTranscriptsToPinecone(transcripts, metadata);

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
        },
      );
    }

    console.log(`✅ Job completed: ${videoId}`);
  } catch (error) {
    console.error(`❌ Job failed: ${videoId}`, error);

    await handleProcessingError(
      ERequestCreateContentType.YoutubeVideo,
      videoId,
      error,
      0,
    );
  }
}
