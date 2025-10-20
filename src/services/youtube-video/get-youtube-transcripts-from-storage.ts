import { TSqlYoutubeVideoTranscriptInsert, TYouTubeTranscriptSegment, TYouTubeTranscriptStandardFormat } from "aiqna_common_v1";
import { getAvailableTranscriptLanguages, TTranscriptTrackHandle } from "./get-available-transcript-languages.js";
import supabaseClient, { BUCKET_TRANSCRIPT } from "../../config/supabase-client.js";
import { convertYouTubeTranscriptSegmentsToStandard } from "./convert-youtube-transcript-segments-to-standard.js";
import { sleep } from "../../utils/sleep.js";
import { fetchYoutubeVideoTranscriptByLanguage } from "./fetch-youtube-video-transcript-by-language.js";
import DBSqlYoutubeVideoTranscript from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video-transcript.js";
import { saveJsonToLocal } from "../../utils/helper-json.js";

/**
 * 여러 언어의 트랜스크립트를 저장하고 결과 반환
 */
export async function getYouTubeTranscriptsFromStorage(
  videoId: string,
  preferredLanguages: string[] = ["ko", "en"],
  supabaseStorageFolder: string = "raw",
  localDiskPath: string = "../data/transcripts",
): Promise<TYouTubeTranscriptStandardFormat[]> {
  try {
    // 1. 사용 가능한 언어 핸들 가져오기
    const availableHandles = await getAvailableLanguageHandles(videoId);
    if (!availableHandles) return [];

    // 2. 처리할 언어 핸들 결정
    const handlesToFetch = selectHandlesToFetch(preferredLanguages, availableHandles);

    // 3. 각 언어별 트랜스크립트 처리
    const savedTranscripts = await getYouTubeTranscriptsFromStorageAfterFetchAndSaveToStorage(
      videoId,
      handlesToFetch,
      supabaseStorageFolder,
      localDiskPath,
    );

    if (savedTranscripts.length === 0) {
      throw new Error(`No transcripts could be saved for video ${videoId}`);
    }

    console.log(`✅ Successfully saved ${savedTranscripts.length} transcript(s)`);
    return savedTranscripts;
  } catch (error) {
    console.error(`❌ Error in saveYouTubeTranscriptsToDb for ${videoId}:`, error);
    return [];
  }
}



/**
 * 1. 사용 가능한 언어 핸들 가져오기
 */
async function getAvailableLanguageHandles(
  videoId: string,
): Promise<TTranscriptTrackHandle[] | null> {
  console.log(`🔍 Checking available languages for ${videoId}...`);
  
  const availableHandles = await getAvailableTranscriptLanguages(videoId);

  if (availableHandles.length === 0) {
    console.warn(`⚠️ No transcripts available for ${videoId}`);
    return null;
  }

  console.log(
    `📋 Available languages: ${availableHandles.map(h => h.language).join(", ")}`
  );
  
  return availableHandles;
}




/**
 * 2. 처리할 언어 핸들 결정 (선호 언어 매칭)
 */
function selectHandlesToFetch(
  preferredLanguages: string[],
  availableHandles: TTranscriptTrackHandle[],
): TTranscriptTrackHandle[] {
  const handlesToFetch: TTranscriptTrackHandle[] = [];

  for (const pref of preferredLanguages) {
    // 1) 정확히 일치
    const exact = availableHandles.find(h => h.language === pref);
    if (exact) {
      handlesToFetch.push(exact);
      continue;
    }

    // 2) 변형 매칭 (en → en-US/en-GB 등)
    const variant = availableHandles.find(h =>
      h.language.toLowerCase().startsWith(pref.toLowerCase() + "-")
    );
    if (variant) {
      handlesToFetch.push(variant);
      console.log(`  ℹ️ Matched '${pref}' to available variant '${variant.language}'`);
    }
  }

  if (handlesToFetch.length === 0) {
    console.warn(
      `⚠️ None of preferred languages [${preferredLanguages.join(", ")}] available. ` +
        `Using first available: ${availableHandles[0].language}`,
    );
    handlesToFetch.push(availableHandles[0]);
  }

  console.log(
    `📥 Fetching transcripts for: ${handlesToFetch.map(h => h.language).join(", ")}`
  );

  return handlesToFetch;
}




/**
 * 3. Get transcripts from Storage
 */
async function getYouTubeTranscriptsFromStorageAfterFetchAndSaveToStorage(
  videoId: string,
  handlesToFetch: TTranscriptTrackHandle[],
  supabaseStorageFolder: string,
  localStoragePath: string,
): Promise<TYouTubeTranscriptStandardFormat[]> {
  const savedTranscripts: TYouTubeTranscriptStandardFormat[] = [];

  for (let i = 0; i < handlesToFetch.length; i++) {
    const handle = handlesToFetch[i];
    const lang = handle.language;

    try {
      // 1. Check cached transcript in Storage
      const cachedTranscript = await tryLoadCachedTranscript(
        videoId,
        lang,
        supabaseStorageFolder,
      );

      if (cachedTranscript) {
        savedTranscripts.push(cachedTranscript);
        continue;
      }

      // 2. Fetch new transcript from YouTube and save to Storage
      const transcript = await fetchTranscriptsFromYouTubeServerAndSaveToStorage(
        videoId,
        lang,
        supabaseStorageFolder,
        localStoragePath,
      );

      if (transcript) {
        savedTranscripts.push(transcript);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`✗ ${lang} 트랜스크립트 처리 실패: ${msg}`);
      continue;
    }

    // 마지막 언어가 아니면 랜덤 대기
    if (i < handlesToFetch.length - 1) {
      await applyThrottling();
    }
  }

  return savedTranscripts;
}



/**
 * 3-1. 캐시된 트랜스크립트 로드 시도
 */
async function tryLoadCachedTranscript(
  videoId: string,
  language: string,
  supabaseStorageFolder: string,
): Promise<TYouTubeTranscriptStandardFormat | null> {
  try {
    const fileName = `${videoId}_${language}.json`;
    const storageFilePath = `${supabaseStorageFolder}/${fileName}`;

    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from(BUCKET_TRANSCRIPT)
      .download(storageFilePath);

    if (downloadError) {
      if ((downloadError as { status?: number })?.status === 404) {
        console.log(`📂 No cache in Supabase Storage for ${language}`);
        return null;
      }
      console.warn(`⚠️ Storage download error for ${language}:`, downloadError);
      return null;
    }

    // ✅ 올바른 UTF-8 디코딩
    const arrayBuffer = await fileData.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    const fileText = decoder.decode(arrayBuffer);
    
    const parsedSegments = JSON.parse(fileText);
    
    // ✅ 인코딩 검증: 첫 세그먼트 확인
    if (parsedSegments.length > 0) {
      const firstText = parsedSegments[0]?.text || '';
      // 깨진 문자 패턴 감지 (ì, ë, ê 등)
      if (/[ì|ë|ê|ìŠ|ì—|í]/.test(firstText)) {
        console.warn(`⚠️ Corrupted encoding detected in ${language}, skipping cache`);
        return null; // 캐시 무효화 -> 재fetch 유도
      }
    }

    const segments = convertYouTubeTranscriptSegmentsToStandard(parsedSegments);

    console.log(`✓ ${language} 트랜스크립트 Supabase Storage 캐시 사용`);

    return {
      videoId,
      language,
      segments,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.warn(
      `⚠️ Error loading ${videoId}_${language} from Storage:`,
      err.message,
    );
    return null;
  }
}




/**
 * 2. Fetch new transcript from YouTube and save to Storage
 */
async function fetchTranscriptsFromYouTubeServerAndSaveToStorage(
  videoId: string,
  language: string,
  supabaseStorageFolder: string,
  localStoragePath: string,
): Promise<TYouTubeTranscriptStandardFormat | null> {
  console.log(`🌐 Fetching ${language} transcript from YouTube...`);

  // 1. Fetch transcript from YouTube API
  const transcriptResult = await fetchYoutubeVideoTranscriptByLanguage(videoId, language);
  const transcriptSegmentsUnknown = extractSegmentsArray(transcriptResult);

  // 2. Save transcript to Storage
  const { uploadSuccess, storageFilePath, fileSizeBytes } = await saveYouTubeTranscriptToSupabaseStorage(
    videoId,
    language,
    transcriptSegmentsUnknown,
    supabaseStorageFolder,
  );

  // 3. Save transcript metadata to DB
  await saveTranscriptMetadata(
    videoId,
    language,
    transcriptSegmentsUnknown,
    transcriptResult,
    uploadSuccess,
    storageFilePath,
    fileSizeBytes,
  );

  // 3-2-4. 표준 포맷 변환
  const transcript = convertToStandardFormat(
    videoId,
    language,
    transcriptSegmentsUnknown,
    transcriptResult,
  );

  // 3-2-5. 로컬 백업 (선택적)
  await saveYouTubeTranscriptToLocalDisk(transcript, videoId, language, localStoragePath);

  console.log(`✅ ${language} 트랜스크립트 처리 완료`);
  return transcript;
}




// 파일 상단 근처
const MIN_DELAY_MS = Number(process.env.TRANSCRIPT_MIN_DELAY_MS ?? 60_000);  // 1분
const MAX_DELAY_MS = Number(process.env.TRANSCRIPT_MAX_DELAY_MS ?? 180_000); // 3분

/**
 * Throttling 적용
 */
async function applyThrottling(): Promise<void> {
  const lo = Math.ceil(MIN_DELAY_MS);
  const hi = Math.floor(MAX_DELAY_MS);
  const ms = Math.floor(Math.random() * (hi - lo + 1)) + lo;

  console.log(`⏳ Throttling for ${(ms / 1000).toFixed(0)}s before next language...`);
  await sleep(ms);
}



// YouTube 자막 fetch 결과에서 우리가 쓰는 필드만 캡처
export interface IMinimalTranscriptResult {
  language: string;
  transcriptSegments: unknown; // 배열 여부는 런타임에서 가드
}


/**
 * 3-2-1. 세그먼트 배열 추출
 */
function extractSegmentsArray(transcriptResult: IMinimalTranscriptResult): unknown[] {
  const raw = transcriptResult.transcriptSegments as unknown;
  return Array.isArray(raw) ? raw : [];
}


/**
 * 3-2-2. Supabase Storage에 저장
 */
async function saveYouTubeTranscriptToSupabaseStorage(
  videoId: string,
  language: string,
  segments: unknown[],
  supabaseStorageFolder: string,
): Promise<{ uploadSuccess: boolean; storageFilePath: string; fileSizeBytes: number }> {
  const fileName = `${videoId}_${language}.json`;
  const storageFilePath = `${supabaseStorageFolder}/${fileName}`;
  
  // ✅ 인코딩 문제 해결: Buffer를 사용하여 올바른 UTF-8로 저장
  const segmentsJson = JSON.stringify(segments, null, 2);
  const buffer = Buffer.from(segmentsJson, 'utf8');
  const fileSizeBytes = buffer.length;

  let uploadSuccess = false;

  try {
    const { error: uploadError } = await supabaseClient.storage
      .from(BUCKET_TRANSCRIPT)
      .upload(storageFilePath, buffer, { // ✅ Buffer 직접 전달
        contentType: "application/json; charset=utf-8", // ✅ charset 명시
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.warn(`⚠️ Storage upload failed for ${language}:`, uploadError.message);
      console.log(`   → Continuing without Storage cache...`);
    } else {
      console.log(`✓ Uploaded to Supabase Storage: ${storageFilePath}`);
      uploadSuccess = true;
    }
  } catch (storageError: unknown) {
    console.warn(`⚠️ Storage upload error for ${language}:`, storageError);
    console.log(`   → Continuing without Storage cache...`);
  }

  return { uploadSuccess, storageFilePath, fileSizeBytes };
}



/**
 * 3. Save transcript metadata to DB
 */
async function saveTranscriptMetadata(
  videoId: string,
  language: string,
  segments: unknown[],
  transcriptResult: IMinimalTranscriptResult,
  uploadSuccess: boolean,
  storageFilePath: string,
  fileSizeBytes: number,
): Promise<void> {
  const totalDuration = calculateTotalDuration(segments);

  const transcriptMetadata: TSqlYoutubeVideoTranscriptInsert = {
    video_id: videoId,
    language: transcriptResult.language,
    total_duration: totalDuration,
    segment_count: segments.length,
    segments_storage_path: uploadSuccess ? storageFilePath : undefined,
    segments_file_size: uploadSuccess ? fileSizeBytes : undefined,
  };

  await DBSqlYoutubeVideoTranscript.insert(transcriptMetadata);
  console.log(`✓ Saved metadata to DB for ${language}`);
}


/**
 * 총 길이 계산
 */
function calculateTotalDuration(segments: unknown[]): number {
  const numericEnds = segments
    .filter(isSegmentMin)
    .map(seg => {
      const endMs = seg.transcript_segment_renderer.end_ms;
      const n = typeof endMs === "string" ? parseFloat(endMs) : 0;
      return Number.isFinite(n) ? n / 1000 : 0;
    });

  return numericEnds.length > 0 ? Math.max(...numericEnds) : 0;
}


// // 최소 필요 타입(끝 시각만 쓰므로 아주 좁게 정의)
type TSegmentRendererMin = { end_ms?: string };
type TSegmentMin = { transcript_segment_renderer: TSegmentRendererMin };

// 런타임 타입가드
function isSegmentMin(x: unknown): x is TSegmentMin {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { transcript_segment_renderer?: unknown };
  if (!o.transcript_segment_renderer || typeof o.transcript_segment_renderer !== "object") return false;
  return true; // end_ms 유무는 선택적이라 존재만 확인
}




/**
 * 3-2-4. 표준 포맷으로 변환
 */
function convertToStandardFormat(
  videoId: string,
  language: string,
  segments: unknown[],
  transcriptResult: IMinimalTranscriptResult,
): TYouTubeTranscriptStandardFormat {
  const transcriptSegmentsTyped = segments.filter(isYouTubeTranscriptSegment);
  const pineconeSegments = convertYouTubeTranscriptSegmentsToStandard(transcriptSegmentsTyped);

  return {
    videoId,
    language: transcriptResult.language,
    segments: pineconeSegments,
  };
}



// 최소 구조만 보는 타입가드 — 프로젝트 타입에 맞게 보강 가능
function isYouTubeTranscriptSegment(x: unknown): x is TYouTubeTranscriptSegment {
  if (typeof x !== "object" || x === null) return false;
  const o = x as { transcript_segment_renderer?: unknown };
  if (!o.transcript_segment_renderer || typeof o.transcript_segment_renderer !== "object") return false;
  // end_ms 같은 필드까지 확인하고 싶으면 아래를 추가
  // const r = o.transcript_segment_renderer as { end_ms?: unknown };
  // if (r.end_ms !== undefined && typeof r.end_ms !== "string") return false;
  return true;
}




/**
 * 3-2-5. 로컬 백업 저장
 */
async function saveYouTubeTranscriptToLocalDisk(
  transcript: TYouTubeTranscriptStandardFormat,
  videoId: string,
  language: string,
  localStoragePath: string,
): Promise<void> {
  if (!localStoragePath) return;

  try {
    await saveJsonToLocal(transcript, videoId, language, localStoragePath);
    const fileName = `${videoId}_${language}.json`;
    console.log(`✓ Backed up to local: ${localStoragePath}/${fileName}`);
  } catch (backupError: unknown) {
    console.warn(`⚠️ Local backup failed for ${language}:`, backupError);
  }
}