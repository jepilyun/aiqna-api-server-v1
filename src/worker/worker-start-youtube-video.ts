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
import { getYouTubeTranscriptsFromStorage } from "../services/youtube-video/get-youtube-transcripts-from-storage.js";
import { sleep } from "../utils/sleep.js";
import { RateLimiterWorkerYouTubeVideo } from "./rate-limiter-worker-youtube-video.js";
import { EProcessingStatusType } from "../consts/const.js";
import { ERequestCreateContentType } from "../consts/const.js";
import { fetchYouTubeVideoDataFromDB } from "../services/youtube-video/fetch-youtube-video-data-from-db.js";
import { saveYouTubeDescriptionToPinecone } from "../services/youtube-video/save-youtube-description-to-pinecone.js";

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
      // Rate Limiter Check (Rest Time)
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
          orderBy: "created_at", // 가장 오래된 것부터 처리
        });

      const job = resultPendingJobs.data?.[0] || null;

      if (!job) {
        console.log("⏳ No pending jobs, waiting...", new Date().toISOString());
        await sleep(1200000); // 1200초(20분) 대기
        continue;
      }

      // 2. 작업 처리
      console.log(`\n🎬 Processing video: ${job.video_id}`);

      // 🔒 자막이 없는 동영상인지 먼저 체크
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

      // 4. Get Transcripts from Storage
      const transcripts = await getYouTubeTranscriptsFromStorage(
        job.video_id,
        ["en", "ko"],
        "raw", // ✅ Supabase Storage 캐시 경로 명시
        "../data/transcripts", // ✅ 로컬 캐시 경로 명시
      );

      // 존재/가져옴 상태를 정확히 반영
      await DBSqlProcessingLogYoutubeVideo.updateByVideoId(job.video_id, {
        is_transcript_exist: transcripts.length > 0, // 0이면 false로 확정
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

      // 6. Rate Limiting 적용
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

          if (videoData.description && videoData.description.length > 40) {
            await saveYouTubeDescriptionToPinecone(videoData, metadata);
          }

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
