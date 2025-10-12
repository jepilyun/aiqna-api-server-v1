import { Request, Response } from "express";
import openaiClient from "../../../config/openai-client.js";
import {
  PINECONE_INDEX_NAME,
  SQL_DB_TABLE,
  TPineconeVectorMetadataForContent,
  TSqlYoutubeVideoDetail,
} from "aiqna_common_v1";
import supabaseClient from "../../../config/supabase-client.js";
import pineconeClient from "../../../config/pinecone-client.js";
import { HelperYouTube } from "../../../utils/helper-youtube.js";

/* =========================
 * Types
 * =======================*/
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

export type TPineconeFilter = {
  $and?: TPineconeFilter[];
  $or?: TPineconeFilter[];
} & Record<string, TPrimitive | TComparator>;

type TPineconeChunkMetadataText = TPineconeVectorMetadataForContent &
  Partial<{
    text: string;
    transcript: string;
  }>;

type TPineconeHit<M extends TPineconeVectorMetadataForContent> = {
  id: string;
  score?: number;
  metadata?: M;
};

interface IAiAskBody {
  q?: string;
  topK?: number;
  lang?: string;
  filters?: TPineconeFilter;
}

/** =========================
 *  Helpers
 *  ========================= */
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

/** =========================
 *  Controller
 *  ========================= */
/**
 * Ctrl For AI Ask
 * YouTube 자막 기반 RAG 검색
 * @param req
 * @param res
 * @returns
 */
export async function ctrlAdminAiAsk(req: Request, res: Response) {
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

    const matches: TPineconeHit<TPineconeChunkMetadataText>[] = (
      pc.matches || []
    ).map((m) => ({
      id: m.id,
      score: m.score,
      metadata: (m.metadata || {}) as TPineconeChunkMetadataText,
    }));

    console.log(`[AI Ask] Found ${matches.length} vector matches`);

    // 5) 결과 없음 처리
    if (!matches.length) {
      return res.status(200).json({
        query: q,
        answer:
          "I couldn't find any relevant information in the video transcripts for your query. Please try rephrasing your question or use different keywords.",
        sources: [],
        videos: [],
        note: "No results from vector search.",
      });
    }

    // 6) 관련 비디오 메타데이터 조회
    const videoIds = Array.from(
      new Set(
        matches
          .map((m) => m.metadata?.video_id)
          .filter((v): v is string => typeof v === "string" && v.length > 0),
      ),
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

    // 7) RAG 컨텍스트 구성
    const topContexts = matches
      .slice(0, Math.min(matches.length, 12))
      .map((m) => {
        const vId = m.metadata?.video_id ?? "unknown";
        const s = m.metadata?.video_start_time;
        const url = HelperYouTube.buildWatchUrl(vId, s);
        const text = m.metadata?.text ?? "";
        return {
          text: String(text).slice(0, 1800),
          source: `Video ${vId} ${m.metadata?.language ? `[${m.metadata.language}]` : ""} @${s ?? 0}s - ${url}`,
        };
      })
      .filter((c) => c.text);

    if (!topContexts.length) {
      return res.status(200).json({
        query: q,
        answer:
          "Found relevant videos but couldn't extract text content. Please check the source videos directly.",
        sources: matches.map((m) => ({
          id: m.id,
          score: m.score,
          videoId: m.metadata?.video_id,
          start: m.metadata?.video_start_time,
          end: m.metadata?.video_end_time,
        })),
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
        const vId = m.metadata?.video_id ?? null;
        const url = vId
          ? HelperYouTube.buildWatchUrl(vId, m.metadata?.video_start_time)
          : null;
        return {
          id: m.id,
          score: m.score,
          videoId: vId,
          language: m.metadata?.language ?? null,
          start: m.metadata?.video_start_time ?? null,
          end: m.metadata?.video_end_time ?? null,
          url,
          text: m.metadata?.text?.slice(0, 200) ?? null, // 미리보기용
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


