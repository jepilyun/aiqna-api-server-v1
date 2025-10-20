import { Request, Response } from "express";
import openaiClient from "../../../config/openai-client.js";
import {
  PINECONE_INDEX_NAME,
  SQL_DB_TABLE,
  IPineconeVectorMetadataBase,
  TSqlYoutubeVideoDetail,
  IPineconeVectorMetadataForVideo,
  IPineconeVectorMetadataForInstagramPost,
  IPineconeVectorMetadataForBlogPost,
} from "aiqna_common_v1";
import supabaseClient from "../../../config/supabase-client.js";
import pineconeClient from "../../../config/pinecone-client.js";
import { HelperYouTube } from "../../../utils/helper-youtube.js";


/* 
 * =========================
 * Types
 * =========================
 */
type TPrimitive = string | number | boolean | null;

type TComparator = {
  $eq?: TPrimitive;
  $ne?: TPrimitive;
  $lt?: number;
  $lte?: number;
  $gt?: number;
  $gte?: number;
  $in?: TPrimitive[];
  $nin?: TPrimitive[];
  $exists?: boolean;
  $contains?: TPrimitive | TPrimitive[];
};

type TPineconeFilter = {
  $and?: TPineconeFilter[];
  $or?: TPineconeFilter[];
} & Record<string, TPrimitive | TComparator>;
interface IAiAskBody {
  q?: string;
  topK?: number;
  lang?: string;
  filters?: TPineconeFilter;
}

type TPineconeHit<M extends IPineconeVectorMetadataBase> = {
  id: string;
  score?: number;
  metadata?: M;
};

/**
 * =========================
 *  Type Guards
 * ========================= 
 */
function isVideoMetadata(
  metadata: IPineconeVectorMetadataBase
): metadata is IPineconeVectorMetadataForVideo {
  return metadata.type === 'video' || 'video_id' in metadata;
}

function isInstagramMetadata(
  metadata: IPineconeVectorMetadataBase
): metadata is IPineconeVectorMetadataForInstagramPost {
  return metadata.type === 'instagram' || 'instagram_post_url' in metadata;
}

function isBlogMetadata(
  metadata: IPineconeVectorMetadataBase
): metadata is IPineconeVectorMetadataForBlogPost {
  return metadata.type === 'blog' || 'blog_post_url' in metadata;
}


/** 
 * =========================
 *  Helpers
 * ========================= 
 */
const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";
const EMBED_DIM = Number(process.env.EMBEDDING_DIM ?? "512");
const MODEL_SUPPORTS_DIM = /^text-embedding-3-/.test(EMBED_MODEL);


/**
 * embed
 * 텍스트 임베딩
 * @param text
 * @returns
 */
async function embed(text: string): Promise<number[]> {
  const payload = {
    model: EMBED_MODEL,
    input: text.slice(0, 4000),
    ...(MODEL_SUPPORTS_DIM ? { dimensions: EMBED_DIM } : {}),
  } as const;

  const r = await openaiClient.embeddings.create(payload);
  const vec = r.data[0].embedding;

  if (MODEL_SUPPORTS_DIM && vec.length !== EMBED_DIM) {
    throw new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${EMBED_DIM}`,
    );
  }

  return vec;
}


/**
 * buildRagPrompt
 * RAG 프롬프트 생성
 * @param query
 * @param contexts
 * @returns
 */
function buildRagPrompt(
  query: string,
  contexts: Array<{ text: string; source: string }>,
) {
  const joined = contexts
    .map((c, i) => `### Source ${i + 1}\n${c.text}\n(${c.source})`)
    .join("\n\n");

  const sys = [
    "You are a helpful AI assistant for answering questions based on YouTube video transcripts.",
    "Answer ONLY using the provided sources from the video transcripts.",
    "If the answer cannot be found in the sources, clearly state that you don't know.",
    "Cite sources inline with (Source N) when referencing specific information.",
    "Provide clear, concise answers in the same language as the query when possible.",
  ].join(" ");

  const user = [`User query: ${query}`, "", "==== Sources ====", joined].join(
    "\n",
  );

  return { system: sys, user };
}

/**
 * generateAnswer
 * 답변 생성
 * @param query
 * @param ctxs
 * @returns
 */
async function generateAnswer(
  query: string,
  ctxs: Array<{ text: string; source: string }>,
) {
  const { system, user } = buildRagPrompt(query, ctxs);
  const r = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return r.choices[0]?.message?.content?.trim() ?? "";
}

/** 
 * =========================
 *  Controller
 * ========================= 
 */
export async function routeCtrlAdminAiAsk(req: Request, res: Response) {
  try {
    const {
      q,
      topK = 12,
      lang,
      filters,
    }: IAiAskBody = (req.body ?? {}) as IAiAskBody;

    // 1) 입력 검증
    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({
        error: "Missing or invalid query 'q'.",
        message: "Please provide a valid search query.",
      });
    }

    console.log(
      `[AI Ask] Query: "${q}", topK: ${topK}, lang: ${lang || "any"}`,
    );

    // 2) 쿼리 임베딩 생성
    const queryEmbedding = await embed(q);
    console.log(
      `[AI Ask] Embedding generated: ${queryEmbedding.length} dimensions`,
    );

    // 3) Pinecone 필터 구성
    const pineconeFilter: TPineconeFilter | undefined = (() => {
      if (filters && lang) return { ...filters, language: lang };
      if (filters) return filters;
      if (lang) return { language: lang };
      return undefined;
    })();

    // 4) Pinecone 벡터 검색
    const pc = await pineconeClient
      .index(PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL)
      .query({
        topK: Math.min(Math.max(topK, 1), 50),
        vector: queryEmbedding,
        includeMetadata: true,
        includeValues: false,
        filter: pineconeFilter,
      });

    const matches: TPineconeHit<IPineconeVectorMetadataBase>[] = (
      pc.matches || []
    ).map((m) => ({
      id: m.id,
      score: m.score,
      metadata: m.metadata as unknown as IPineconeVectorMetadataBase,
    }));

    console.log(`[AI Ask] Found ${matches.length} vector matches`);

    // 5) 결과 없음 처리
    if (!matches.length) {
      return res.status(200).json({
        query: q,
        answer:
          "I couldn't find any relevant information for your query. Please try rephrasing your question or use different keywords.",
        sources: [],
        videos: [],
        note: "No results from vector search.",
      });
    }

    // 6) 비디오 메타데이터만 필터링하여 조회
    const videoMatches = matches.filter((m) => 
      m.metadata && isVideoMetadata(m.metadata)
    );

    const videoIds = Array.from(
      new Set(
        videoMatches
          .map((m) => (m.metadata as IPineconeVectorMetadataForVideo).video_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    );

    let videos: TSqlYoutubeVideoDetail[] = [];
    if (videoIds.length) {
      const { data, error } = await supabaseClient
        .from(SQL_DB_TABLE.youtube_videos)
        .select("*")
        .in("video_id", videoIds)
        .overrideTypes<TSqlYoutubeVideoDetail[]>();

      if (error) {
        console.warn("[AI Ask] Supabase query failed:", error.message);
      } else {
        videos = data ?? [];
        console.log(`[AI Ask] Fetched ${videos.length} video details`);
      }
    }

    // 7) RAG 컨텍스트 구성 - 모든 타입 지원
    const topContexts = matches
      .slice(0, Math.min(matches.length, 12))
      .map((m) => {
        if (!m.metadata) return null;

        const text = m.metadata.text ?? "";
        let source = "";

        if (isVideoMetadata(m.metadata)) {
          const vId = m.metadata.video_id ?? "unknown";
          const s = m.metadata.video_start_time;
          const url = HelperYouTube.buildWatchUrl(vId, s);
          source = `Video ${vId} ${m.metadata.language ? `[${m.metadata.language}]` : ""} @${s ?? 0}s - ${url}`;
        } else if (isInstagramMetadata(m.metadata)) {
          const url = m.metadata.instagram_post_url ?? "unknown";
          source = `Instagram ${m.metadata.language ? `[${m.metadata.language}]` : ""} - ${url}`;
        } else if (isBlogMetadata(m.metadata)) {
          const url = m.metadata.blog_post_url ?? "unknown";
          source = `Blog ${m.metadata.language ? `[${m.metadata.language}]` : ""} - ${url}`;
        } else {
          source = `Source ${m.metadata.language ? `[${m.metadata.language}]` : ""}`;
        }

        return {
          text: String(text).slice(0, 1800),
          source,
        };
      })
      .filter((c): c is { text: string; source: string } => 
        c !== null && c.text.length > 0
      );

    if (!topContexts.length) {
      return res.status(200).json({
        query: q,
        answer:
          "Found relevant content but couldn't extract text. Please check the sources directly.",
        sources: matches.map((m) => {
          if (!m.metadata) return { id: m.id, score: m.score };
          
          if (isVideoMetadata(m.metadata)) {
            return {
              id: m.id,
              score: m.score,
              type: 'video',
              videoId: m.metadata.video_id,
              start: m.metadata.video_start_time,
              end: m.metadata.video_end_time,
            };
          }
          
          return { id: m.id, score: m.score, type: m.metadata.type };
        }),
        videos,
        note: "No textual chunks found in metadata.",
      });
    }

    // 8) LLM을 사용한 답변 생성
    console.log(
      `[AI Ask] Generating answer with ${topContexts.length} contexts`,
    );
    const answer = await generateAnswer(q, topContexts);

    // 9) 최종 응답
    return res.json({
      query: q,
      answer,
      sources: matches.map((m) => {
        if (!m.metadata) {
          return {
            id: m.id,
            score: m.score,
            type: 'unknown',
          };
        }

        const baseSource = {
          id: m.id,
          score: m.score,
          language: m.metadata.language ?? null,
          text: m.metadata.text?.slice(0, 200) ?? null,
        };

        if (isVideoMetadata(m.metadata)) {
          const vId = m.metadata.video_id ?? null;
          const url = vId
            ? HelperYouTube.buildWatchUrl(vId, m.metadata.video_start_time)
            : null;
          
          return {
            ...baseSource,
            type: 'video',
            videoId: vId,
            start: m.metadata.video_start_time ?? null,
            end: m.metadata.video_end_time ?? null,
            url,
          };
        } else if (isInstagramMetadata(m.metadata)) {
          return {
            ...baseSource,
            type: 'instagram',
            url: m.metadata.instagram_post_url ?? null,
            imageUrl: m.metadata.local_image_url ?? null,
          };
        } else if (isBlogMetadata(m.metadata)) {
          return {
            ...baseSource,
            type: 'blog',
            url: m.metadata.blog_post_url ?? null,
            platform: m.metadata.blog_platform ?? null,
          };
        }

        return {
          ...baseSource,
          type: m.metadata.type ?? 'unknown',
        };
      }),
      videos: videos.map((v) => ({
        video_id: v.video_id,
        title: v.title,
        channel_id: v.channel_id,
        thumbnail_url: v.thumbnail_url,
        published_date: v.published_date,
        view_count: v.view_count,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[AI Ask] Failed:", message);
    console.error(error);

    return res.status(500).json({
      error: "AI Ask failed",
      message: message,
      details: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
}






