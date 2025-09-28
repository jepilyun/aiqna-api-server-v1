import { Request, Response } from "express";
import openaiClient from "../config/openai-client.js";
import {
  PINECONE_INDEX_NAME,
  SQL_DB_TABLE,
  TPineconeYouTubeTranscriptMetadata,
  TSqlYoutubeVideoDetail,
} from "aiqna_common_v1";
import supabaseClient from "../config/supabase-client.js";
import pineconeClient from "../config/pinecone-client.js";

/* =========================
 * Types (no any)
 * =======================*/
type Primitive = string | number | boolean | null;

// Pinecone 필터(대표 연산자만 포함; 필요 시 확장)
type Comparator = {
  $eq?: Primitive;
  $ne?: Primitive;
  $lt?: number;
  $lte?: number;
  $gt?: number;
  $gte?: number;
  $in?: Primitive[];
  $nin?: Primitive[];
  $exists?: boolean;
  // 선택: 배열/문자 포함 검색이 필요하면 열어두기
  $contains?: Primitive | Primitive[];
};

export type PineconeFilter = {
  $and?: PineconeFilter[];
  $or?: PineconeFilter[];
} & Record<string, Primitive | Comparator>;

// 메타데이터에 chunk 본문이 저장됐을 수도 있는 경우 대비
type TPineconeChunkMetadataText = TPineconeYouTubeTranscriptMetadata &
  Partial<{
    text: string;
    transcript: string;
  }>;

type PineconeHit<M extends TPineconeYouTubeTranscriptMetadata = TPineconeYouTubeTranscriptMetadata> = {
  id: string;
  score?: number;
  metadata?: M;
};

interface SearchTravelBody {
  q?: string;
  topK?: number;
  lang?: string;
  filters?: PineconeFilter;
}

/** =========================
 *  Helpers
 *  ========================= */
// 상단에 환경변수로도 조절 가능하게
const EMBED_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"; // 3-small 기본
const EMBED_DIM = Number(process.env.EMBEDDING_DIM ?? "512"); // ← 인덱스 차원과 동일해야 함(지금은 512)

// 3계열 모델 여부 판단(3계열만 dimensions 지원)
const MODEL_SUPPORTS_DIM = /^text-embedding-3-/.test(EMBED_MODEL);

async function embed(text: string): Promise<number[]> {
  const payload = {
    model: EMBED_MODEL,
    input: text.slice(0, 4000),
    ...(MODEL_SUPPORTS_DIM ? { dimensions: EMBED_DIM } : {}),
  } as const;

  const r = await openaiClient.embeddings.create(payload);
  const vec = r.data[0].embedding;

  // 런타임 가드: 임베딩 길이가 기대 차원과 다르면 즉시 에러
  if (MODEL_SUPPORTS_DIM && vec.length !== EMBED_DIM) {
    throw new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${EMBED_DIM}`,
    );
  }
  return vec;
}

function toYouTubeWatchUrl(videoId: string, start?: number) {
  const t = start ? `&t=${Math.max(0, Math.floor(start))}s` : "";
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}

function buildRagPrompt(
  query: string,
  contexts: Array<{ text: string; source: string }>,
) {
  const joined = contexts
    .map((c, i) => `### Source ${i + 1}\n${c.text}\n(${c.source})`)
    .join("\n\n");

  const sys = [
    "You are a helpful travel assistant.",
    "Answer ONLY using the provided sources.",
    "If unsure, say you don't know.",
    "Cite briefly with (Source N) inline when useful.",
  ].join(" ");

  const user = [`User query: ${query}`, "", "==== Sources ====", joined].join(
    "\n",
  );

  return { system: sys, user };
}

async function generateAnswer(
  query: string,
  ctxs: Array<{ text: string; source: string }>,
) {
  const { system, user } = buildRagPrompt(query, ctxs);
  const r = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini", // 비용/속도 적절한 모델 추천
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
export async function ctrlSearchTravel(req: Request, res: Response) {
  try {
    const {
      q,
      topK = 12,
      lang,
      filters,
    }: SearchTravelBody = (req.body ?? {}) as SearchTravelBody;

    if (!q || typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Missing query 'q'." });
    }

    // 1) 임베딩
    const queryEmbedding = await embed(q);

    // 2) Pinecone 검색 (언어/기타 메타 필터)
    const pineconeFilter: PineconeFilter | undefined = (() => {
      // filters가 없고 lang만 있는 경우도 안전하게 커버
      if (filters && lang) return { ...filters, language: lang };
      if (filters) return filters;
      if (lang) return { language: lang };
      return undefined;
    })();

    const pc = await pineconeClient
      .index(PINECONE_INDEX_NAME.YOUTUBE_TRANSCRIPT_TRAVEL_SEOUL.OPENAI_SMALL)
      .query({
        topK: Math.min(Math.max(topK, 1), 50),
        vector: queryEmbedding,
        includeMetadata: true,
        includeValues: false,
        filter: pineconeFilter,
      });

    const matches: PineconeHit<TPineconeChunkMetadataText>[] = (
      pc.matches || []
    ).map((m) => ({
      id: m.id,
      score: m.score,
      metadata: (m.metadata || {}) as TPineconeChunkMetadataText,
    }));

    if (!matches.length) {
      return res.status(200).json({
        query: q,
        answer: null,
        sources: [],
        videos: [],
        note: "No results from vector search.",
      });
    }

    // 3) videoId 수집 → Supabase 조회
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
        console.warn("Supabase query failed:", error.message);
      } else {
        videos = data ?? [];
      }
    }

    // 4) 컨텍스트 구성
    const topContexts = matches
      .slice(0, Math.min(matches.length, 12))
      .map((m) => {
        const vId = m.metadata?.video_id ?? "unknown";
        const s = m.metadata?.start_time;
        const url = toYouTubeWatchUrl(vId, s);
        const text = m.metadata?.text ?? "";
        return {
          text: String(text).slice(0, 1800),
          source: `Video ${vId} ${m.metadata?.language ? `[${m.metadata.language}]` : ""} @${
            s ?? 0
          }s ${url}`,
        };
      })
      .filter((c) => c.text);

    if (!topContexts.length) {
      return res.status(200).json({
        query: q,
        answer: null,
        sources: matches.map((m) => ({
          id: m.id,
          score: m.score,
          videoId: m.metadata?.video_id,
          start: m.metadata?.start_time,
          end: m.metadata?.end_time,
        })),
        videos,
        note: "No textual chunks found in metadata. Ensure chunk text is stored in metadata or fetchable by chunk_id.",
      });
    }

    // 5) LLM RAG
    const answer = await generateAnswer(q, topContexts);

    // 6) 응답
    return res.json({
      query: q,
      answer,
      sources: matches.map((m) => {
        const vId = m.metadata?.video_id ?? null;
        const url = vId ? toYouTubeWatchUrl(vId, m.metadata?.start_time) : null;
        return {
          id: m.id,
          score: m.score,
          videoId: vId,
          language: m.metadata?.language ?? null,
          start: m.metadata?.start_time ?? null,
          end: m.metadata?.end_time ?? null,
          url,
        };
      }),
      videos,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ctrlSearchTravel failed:", message);
    return res.status(500).json({ error: "Search failed", message });
  }
}
