import {
  TYouTubeTranscriptStandardFormat,
  IPineconeVectorMetadataForVideo,
  TPineconeVector,
} from "aiqna_common_v1";
import { chunkYouTubeVideoTranscript } from "../chunk/chunk-youtube-video-transcript.js";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorYouTubeVideo } from "../metadata-generator/metadata-generator-youtube-video.js";
import { METADATA_GENERATOR_MODEL, METADATA_GENERATOR_MODEL_NAME, METADATA_GENERATOR_PROVIDER, PROVIDER_CONFIGS } from "../../consts/const.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType } from "../../consts/const.js";
import {
  safeForEmbedding,
  toSnippet,
} from "../../utils/chunk-embedding-utils.js";
import { saveDataToLocal } from "../../utils/save-file.js";
import DBSqlYoutubeVideo from "../../db-ctrl/db-ctrl-sql/db-sql-youtube-video.js";


type TTranscriptBaseChunk = { text: string; startTime: number; endTime: number };

/**
 * 문장 단위로 자르기
 * @param text
 * @returns
 */
function splitBySentences(text: string): string[] {
  // . ! ? 기준 대략적 분할 (필요하면 더 정교한 splitter로 교체)
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z가-힣0-9])/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 문장 단위로 자르고, maxChars/overlapChars/maxDurationSec 강제
 * @param raw
 * @param opts
 * @returns
 */
function normalizeChunks(
  raw: TTranscriptBaseChunk[],
  opts: {
    maxChars: number;
    overlapChars?: number;
    maxDurationSec?: number;
    minChars?: number;
  },
): TTranscriptBaseChunk[] {
  const maxChars = Math.max(200, opts.maxChars);
  const overlapChars = Math.max(0, opts.overlapChars ?? 0);
  const maxDur = opts.maxDurationSec ?? Infinity;
  const minChars = opts.minChars ?? 0;

  const out: TTranscriptBaseChunk[] = [];

  for (const c of raw) {
    // 이미 충분히 짧고, 시간도 OK면 그대로 사용
    const dur = (c.endTime ?? 0) - (c.startTime ?? 0);
    if (c.text.length <= maxChars && dur <= maxDur) {
      out.push(c);
      continue;
    }

    // 1) 문장 단위로 분해
    const sentences = splitBySentences(c.text);
    if (sentences.length === 0) continue;

    // 2) 누적하면서 maxChars / maxDurationSec 기준으로 새 청크 생성
    let buf = "";
    let curStart = c.startTime;
    let curEnd = c.startTime;
    const totalDur = Math.max(0, dur);
    const secPerChar =
      totalDur > 0 && c.text.length > 0 ? totalDur / c.text.length : 0;

    const pushBuf = () => {
      const text = buf.trim();
      if (!text) return;
      // 길이 보정
      if (text.length < minChars && out.length) {
        // 직전 청크에 합치기(너무 잘게 쪼개진 경우)
        const last = out[out.length - 1];
        const joinText = last.text + " " + text;
        out[out.length - 1] = {
          ...last,
          text: joinText,
          endTime: last.endTime + text.length * secPerChar,
        };
      } else {
        out.push({
          text,
          startTime: curStart,
          endTime: curStart + text.length * secPerChar,
        });
      }
      buf = "";
      curStart = curEnd; // 다음 시작은 지금 끝부터(근사)
    };

    for (const s of sentences) {
      // 임시로 추가했을 때 길이/시간 체크
      const tentative = (buf ? buf + " " : "") + s;
      const tentativeDur = tentative.length * secPerChar;

      if (tentative.length > maxChars || tentativeDur > maxDur) {
        // 현재 버퍼를 먼저 확정
        if (buf) {
          curEnd = curStart + buf.length * secPerChar;
          pushBuf();

          // 오버랩 적용(문자 기반)
          if (overlapChars > 0 && out.length > 0) {
            const prev = out[out.length - 1];
            const ovText = prev.text.slice(-overlapChars);
            buf = ovText + " " + s;
            curStart = prev.endTime - ovText.length * secPerChar;
            curEnd = curStart + buf.length * secPerChar;
            continue;
          }
        }

        // 문장 자체가 너무 길면 hard-split
        if (s.length > maxChars) {
          let i = 0;
          while (i < s.length) {
            const piece = s.slice(i, i + maxChars);
            out.push({
              text: piece,
              startTime: curStart,
              endTime: curStart + piece.length * secPerChar,
            });
            curStart += piece.length * secPerChar;
            i += maxChars;
          }
          buf = "";
          continue;
        }

        // 새 버퍼 시작
        buf = s;
        curEnd = curStart + buf.length * secPerChar;
      } else {
        // 버퍼에 누적
        buf = tentative;
        curEnd = curStart + buf.length * secPerChar;
      }
    }
    // 남은 버퍼 푸시
    if (buf) {
      pushBuf();
    }
  }

  return out;
}

/**
 * Save YouTube Transcripts to Pinecone
 * @param transcriptsOfAllLanguages
 * @param vectorMetadata
 */
export async function saveYouTubeTranscriptsToPinecone(
  transcriptsOfAllLanguages: TYouTubeTranscriptStandardFormat[],
  vectorMetadata: Partial<IPineconeVectorMetadataForVideo>,
) {
  if (!vectorMetadata) {
    throw new Error("Metadata Needed");
  }

  try {
    const embeddingProvider = new OpenAIEmbeddingProvider();

    const metadataExtractor = new MetadataGeneratorYouTubeVideo({
      provider: METADATA_GENERATOR_PROVIDER,
      model: METADATA_GENERATOR_MODEL,
      modelName: METADATA_GENERATOR_MODEL_NAME,
    });

    let metadataUpdated = false;

    for (const transcript of transcriptsOfAllLanguages) {
      console.log(
        `📝 Tier 2/3: Saving ${transcript.language} transcript chunks...`,
      );

      const contentKey = ContentKeyManager.createContentKey(
        ERequestCreateContentType.YoutubeVideo,
        transcript.videoId,
        transcript.language,
      );

      const chunksRaw = chunkYouTubeVideoTranscript(transcript.segments);

      // DEV Save File
      // ytb_video_XXXXXXXX_s08_transcript_lang_XX_full_chunk_raw.txt [파일 체크 필요함]
      saveDataToLocal(chunksRaw, `ytb_video_${transcript.videoId}_s08_transcript_lang_${transcript.language}`, "full_chunk_raw", "txt", "../data/metaYouTube");

      const fullChunkText = chunksRaw.map((chunk) => chunk.text).join(" ");

      // DEV Save File
      // ytb_video_XXXXXXXX_s09_transcript_lang_XX_full_chunk_text.txt [파일 체크 필요함]
      saveDataToLocal(fullChunkText, `ytb_video_${transcript.videoId}_s09_transcript_lang_${transcript.language}`, "full_chunk_text", "txt", "../data/metaYouTube");

      const rawMetadataFromFullChunkText = await metadataExtractor.generateMetadataFromText(
        transcript.videoId,
        vectorMetadata.title ?? "",
        fullChunkText,
        transcript.language,
      );

      if (!rawMetadataFromFullChunkText) {
        console.warn(
          `⚠️  No metadata generated for ${transcript.language}, skipping...`,
        );
        continue;
      }

      // DEV Save File
      // ytb_video_XXXXXXXX_s10_transcript_lang_XX_meta_raw_from_full_chunk_text.txt [파일 체크 필요함]
      saveDataToLocal(rawMetadataFromFullChunkText, `ytb_video_${transcript.videoId}_s10_transcript_lang_${transcript.language}`, "meta_raw_from_full_chunk_text", "txt", "../data/metaYouTube");

      const parsedMetadataFromFullChunkText = await metadataExtractor.parseResponse(rawMetadataFromFullChunkText);

      if (!parsedMetadataFromFullChunkText) {
        console.warn(
          `⚠️  No parsed metadata generated for ${transcript.language}, skipping...`,
        );
        continue;
      }

      // DEV Save File
      // ytb_video_XXXXXXXX_s11_transcript_lang_XX_meta_parsed_from_full_chunk_text.txt [파일 체크 필요함]
      saveDataToLocal(parsedMetadataFromFullChunkText, `ytb_video_${transcript.videoId}_s11_transcript_lang_${transcript.language}`, "meta_parsed_from_full_chunk_text", "txt", "../data/metaYouTube");

      if (!metadataUpdated) {
        await DBSqlYoutubeVideo.updateByVideoId(transcript.videoId, {
          info_country: parsedMetadataFromFullChunkText.info_country,
          info_city: parsedMetadataFromFullChunkText.info_city,
          info_district: parsedMetadataFromFullChunkText.info_district,
          info_neighborhood: parsedMetadataFromFullChunkText.info_neighborhood,
          info_landmark: parsedMetadataFromFullChunkText.info_landmark,
          info_category: parsedMetadataFromFullChunkText.info_category,
          info_name: parsedMetadataFromFullChunkText.info_name,
          info_special_tag: parsedMetadataFromFullChunkText.info_special_tag,
          info_influencer: parsedMetadataFromFullChunkText.info_influencer,
          info_season: parsedMetadataFromFullChunkText.info_season,
          info_time_of_day: parsedMetadataFromFullChunkText.info_time_of_day,
          info_activity_type: parsedMetadataFromFullChunkText.info_activity_type,
          // info_target_audience: metadataFromFullChunkText.info_target_audience,
          info_reservation_required: parsedMetadataFromFullChunkText.info_reservation_required,
          info_travel_tips: parsedMetadataFromFullChunkText.info_travel_tips,
        });
        metadataUpdated = true;
      }

      // 후처리로 강제 재청킹
      const chunks = normalizeChunks(chunksRaw as TTranscriptBaseChunk[], {
        maxChars: 900,
        overlapChars: 150,
        maxDurationSec: 120,
        minChars: 300,
      });

      if (chunks.length === 0) {
        console.warn(
          `⚠️  No chunks generated for ${transcript.language}, skipping...`,
        );
        continue;
      }

      const vectors: TPineconeVector[] = await Promise.all(
        chunks.map(async (chunk, idx) => {
          // 첫 2개만 상세 로그
          if (idx < 2) {
            console.log(
              `Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`,
            );
          }

          // 1. 임베딩 생성
          const embedding = await embeddingProvider.generateEmbedding(
            safeForEmbedding(chunk.text),
            PROVIDER_CONFIGS.openai.model,
          );

          // 2. 청크별 메타데이터 추출
          let chunkParsedMetadata: TAnalyzedContentMetadata | null = null;

          try {
            const chunkRawMetadata =
              await metadataExtractor.generateMetadataFromText(transcript.videoId, vectorMetadata.title ?? "", chunk.text, transcript.language);

            if (!chunkRawMetadata) {
              console.warn(`⚠️  No metadata generated for chunk ${idx}, continuing without metadata...`);
            } else {
              // DEV Save File
              // ytb_video_XXXXXXXX_s12_transcript_lang_XX_meta_raw_from_chunk_text_index_[01].txt [파일 체크 필요함]
              saveDataToLocal(chunkRawMetadata, `ytb_video_${transcript.videoId}_s12_transcript_lang_${transcript.language}_meta_raw_from_chunk_text_index_${idx}`, "meta_raw_from_chunk_text", "txt", "../data/metaYouTube");

              chunkParsedMetadata = await metadataExtractor.parseResponse(chunkRawMetadata);

              if (!chunkParsedMetadata) {
                console.warn(`⚠️  No parsed metadata generated for chunk ${idx}, continuing without metadata...`);
              }

              // DEV Save File
              // ytb_video_XXXXXXXX_s13_transcript_lang_XX_meta_parsed_from_chunk_text_index_[01].txt [파일 체크 필요함]
              saveDataToLocal(chunkParsedMetadata, `ytb_video_${transcript.videoId}_s13_transcript_lang_${transcript.language}_meta_parsed_from_chunk_text_index_${idx}`, "meta_parsed_from_chunk_text", "txt", "../data/metaYouTube");
            }

            if (idx < 2) {
              console.log(`Metadata:`, {
                info_country: chunkParsedMetadata?.info_country,
                info_city: chunkParsedMetadata?.info_city,
                info_district: chunkParsedMetadata?.info_district,
                info_neighborhood: chunkParsedMetadata?.info_neighborhood,
                info_landmark: chunkParsedMetadata?.info_landmark,
                info_category: chunkParsedMetadata?.info_category,
                info_name: chunkParsedMetadata?.info_name,
                info_special_tag: chunkParsedMetadata?.info_special_tag,
                info_influencer: chunkParsedMetadata?.info_influencer,
                info_season: chunkParsedMetadata?.info_season,
                info_time_of_day: chunkParsedMetadata?.info_time_of_day,
                info_activity_type: chunkParsedMetadata?.info_activity_type,
                info_target_audience: chunkParsedMetadata?.info_target_audience,
                info_reservation_required: chunkParsedMetadata?.info_reservation_required,
                info_travel_tips: chunkParsedMetadata?.info_travel_tips,
                language: chunkParsedMetadata?.language,
                sentimentScore: chunkParsedMetadata?.sentimentScore,
                mainTopic: chunkParsedMetadata?.mainTopic,
                confidence_score: chunkParsedMetadata?.confidence_score,
              });
            }
          } catch (metadataError) {
            console.warn(
              `    ⚠️  Metadata extraction failed for chunk ${idx}:`,
              metadataError,
            );
          }

          const chunkId = ContentKeyManager.createChunkId(contentKey, idx);

          const metadata: Record<string, string | number | boolean | string[]> =
            {
              video_id: transcript.videoId,
              title: vectorMetadata.title ?? "",
              type: "transcript", // 🔥 검색 필터용
              content_type: "youtube_video_transcript",
              language: transcript.language,
              chunk_index: idx,
              chunk_id: chunkId,
              start_time: chunk.startTime,
              end_time: chunk.endTime,
              text: toSnippet(chunk.text),
              text_length: chunk.text.length,
              embedding_model: PROVIDER_CONFIGS.openai.model,
              embedding_dimensions: embeddingProvider.getDimensions(
                PROVIDER_CONFIGS.openai.model,
              ),
              created_at: new Date().toISOString(),
            };

          // 기존 비디오 메타데이터
          if (vectorMetadata.channel_title)
            metadata.channel_title = vectorMetadata.channel_title;
          if (vectorMetadata.channel_id)
            metadata.channel_id = vectorMetadata.channel_id;
          if (vectorMetadata.published_date)
            metadata.published_at = vectorMetadata.published_date;
          if (vectorMetadata.thumbnail_url)
            metadata.thumbnail_url = vectorMetadata.thumbnail_url;
          if (vectorMetadata.duration)
            metadata.duration = vectorMetadata.duration;
          if (vectorMetadata.view_count)
            metadata.view_count = vectorMetadata.view_count;
          if (vectorMetadata.like_count)
            metadata.like_count = vectorMetadata.like_count;

          // 청크별 추출된 메타데이터 추가
          if (chunkParsedMetadata) {
            if (chunkParsedMetadata.info_country.length > 0) {
              metadata.info_country = chunkParsedMetadata.info_country;
            }
            if (chunkParsedMetadata.info_city.length > 0) {
              metadata.info_city = chunkParsedMetadata.info_city;
            }
            if (chunkParsedMetadata.info_district.length > 0) {
              metadata.info_district = chunkParsedMetadata.info_district;
            }
            if (chunkParsedMetadata.info_neighborhood.length > 0) {
              metadata.info_neighborhood = chunkParsedMetadata.info_neighborhood;
            }
            if (chunkParsedMetadata.info_category.length > 0) {
              metadata.info_category = chunkParsedMetadata.info_category;
            }
            if (chunkParsedMetadata.info_name.length > 0) {
              metadata.info_name = chunkParsedMetadata.info_name;
            }
            if (chunkParsedMetadata.info_special_tag.length > 0) {
              metadata.info_special_tag = chunkParsedMetadata.info_special_tag;
            }
            if (chunkParsedMetadata.info_influencer.length > 0) {
              metadata.info_influencer = chunkParsedMetadata.info_influencer;
            }
            if (chunkParsedMetadata.info_season.length > 0) {
              metadata.info_season = chunkParsedMetadata.info_season;
            }
            if (chunkParsedMetadata.info_time_of_day.length > 0) {
              metadata.info_time_of_day = chunkParsedMetadata.info_time_of_day;
            }
            if (chunkParsedMetadata.info_activity_type.length > 0) {
              metadata.info_activity_type = chunkParsedMetadata.info_activity_type;
            }
            if (chunkParsedMetadata.info_target_audience.length > 0) {
              metadata.info_target_audience = chunkParsedMetadata.info_target_audience;
            }
            if (chunkParsedMetadata.info_reservation_required) {
              metadata.info_reservation_required = chunkParsedMetadata.info_reservation_required;
            }
            // if (extractedMetadata.info_travel_tips.length > 0) {
            //   metadata.info_travel_tips = extractedMetadata.info_travel_tips;
            // }
            if (chunkParsedMetadata.language) {
              metadata.language = chunkParsedMetadata.language;
            }
            if (chunkParsedMetadata.sentimentScore) {
              metadata.sentimentScore = chunkParsedMetadata.sentimentScore;
            }
            if (chunkParsedMetadata.mainTopic) {
              metadata.mainTopic = chunkParsedMetadata.mainTopic;
            }
            if (chunkParsedMetadata.confidence_score) {
              metadata.confidence_score = chunkParsedMetadata.confidence_score;
            }
          }

          return {
            id: chunkId,
            values: embedding,
            metadata,
          };
        }),
      );

      // DBPinecone을 사용한 배치 업로드
      await DBPinecone.upsertBatch(PROVIDER_CONFIGS.openai.index, vectors, 100);

      console.log(
        `  ✓ Completed ${chunks.length} chunks for ${transcript.language}`,
      );
    }

    console.log(`[${PROVIDER_CONFIGS.openai.type}] ✓ Success`);
    return { provider: PROVIDER_CONFIGS.openai.type, status: "success" };
  } catch (error) {
    console.error(
      `[${PROVIDER_CONFIGS.openai.type}] ✗ Failed:`,
      (error as Error).message,
    );
    return { provider: PROVIDER_CONFIGS.openai.type, status: "error", error };
  }
}
