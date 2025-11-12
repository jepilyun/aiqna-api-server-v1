import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { METADATA_GENERATOR_DEFAULT_MODELS } from "../../consts/const.js";
import { TAnalyzedContentMetadata, TLLMRaw, TTravelTipItem } from "../../types/shared.js";
import { sleep } from "../../utils/sleep.js";
import { buildSystemPrompt, buildUserPrompt, TMetadataPromptGeneratorOptions } from "./build-prompt.js";

type SourceType = "youtube" | "instagram" | "blog" | "text";

/**
 * Base Metadata Generator
 * - 모든 소스 타입에서 공통으로 사용하는 로직
 */
export abstract class BaseMetadataGenerator {
  constructor(protected readonly options: TMetadataPromptGeneratorOptions = {}) {}

  /**
   * 소스 타입 반환 (자식 클래스에서 구현)
   */
  protected abstract getSourceType(): SourceType;

  /**
   * 사용 후보 모델 목록 계산
   */
  protected getModelCandidates() {
    const { provider, model } = this.options;
    if (provider && model) {
      return [{ provider, model }];
    }
    return METADATA_GENERATOR_DEFAULT_MODELS;
  }

  /**
   * 빈 메타데이터 반환
   */
  protected getEmptyMetadata(language: string = "ko"): TAnalyzedContentMetadata {
    return {
      info_country: [],
      info_city: [],
      info_district: [],
      info_neighborhood: [],
      info_landmark: [],
      info_category: [],
      info_name: [],
      info_special_tag: [],
      info_influencer: [],
      info_season: [],
      info_time_of_day: [],
      info_activity_type: [],
      info_target_audience: [],
      info_reservation_required: false,
      info_travel_tips: [],
      language,
      sentimentScore: 0.5,
      mainTopic: "",
      confidence_score: 0,
    };
  }

  /**
   * 메타데이터 추출 (공통 로직)
   */
  protected async extractMetadata(params: {
    content: string;
    title?: string;
    language?: string;
    identifier: string; // 로그용 식별자 (URL, videoId 등)
  }): Promise<string | null> {
    const { content, title, language = "ko", identifier } = params;

    if (content.length === 0) {
      console.warn(`⚠️ No content available for ${identifier}`);
      return null;
    }

    const userPrompt = this.buildUserPrompt(content, title, language);
    const systemPrompt = this.buildSystemPrompt();
    const modelCandidates = this.getModelCandidates();

    for (let i = 0; i < modelCandidates.length; i++) {
      const { provider, model } = modelCandidates[i];

      try {
        console.log(`🔄 Trying ${provider}/${model} for ${identifier}`);

        const rawResponse = await this.analyzeWithProvider(systemPrompt, userPrompt, provider, model);
        if (!rawResponse) {
          console.warn(`⚠️ No response from ${provider}/${model} for ${identifier}`);
          continue;
        }

        console.log(`✅ Successfully extracted metadata using ${provider}/${model}`);
        return rawResponse;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ ${provider}/${model} failed for ${identifier}: ${errorMessage}`);

        if (i < modelCandidates.length - 1) {
          console.log(`🔄 Trying next model...`);
          await sleep(2000);
          continue;
        }

        // 마지막 모델까지 실패한 경우 에러를 throw
        throw new Error(
          `All models failed for ${identifier}. Last error: ${errorMessage}`
        );
      }
    }

    // 이 라인에는 도달하지 않지만 TypeScript를 위해 유지
    throw new Error(`Unexpected error: no models were tried for ${identifier}`);
  }

  /**
   * Provider별 분석 (통합)
   */
  private async analyzeWithProvider(
    systemPrompt: string,
    userPrompt: string,
    provider: string,
    model: string,
  ): Promise<string | null> {
    switch (provider) {
      case "groq":
        return this.analyzeWithGroq(systemPrompt, userPrompt, model);
      case "openai":
        return this.analyzeWithOpenAI(systemPrompt, userPrompt, model);
      case "ollama":
        return this.analyzeWithOllama(systemPrompt, userPrompt, model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Groq API 분석
   */
  private async analyzeWithGroq(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<string | null> {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 3072,
      response_format: { type: "json_object" },
    });

    return completion.choices[0].message.content ?? null;
  }

  /**
   * OpenAI API 분석
   */
  private async analyzeWithOpenAI(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<string | null> {
    const completion = await openaiClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 3072,
      response_format: { type: "json_object" },
    });

    return completion.choices[0].message.content ?? null;
  }

  /**
   * Ollama API 분석
   */
  private async analyzeWithOllama(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<string | null> {
    const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    const completion = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n\n규칙: 반드시 단일 JSON 객체만 출력하고, 앞뒤 설명/코드펜스/마크다운 금지.`,
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!completion.ok) {
      const text = await completion.text().catch(() => "");
      throw new Error(`ollama http ${completion.status}: ${text || completion.statusText}`);
    }

    const json = await completion.json();
    const content =
      json?.message?.content ?? (Array.isArray(json?.messages) ? json.messages.at(-1)?.content : null);

    return content ?? null;
  }

  /**
   * 응답 파싱 (통합)
   */
  public async parseResponse(content: string | null | undefined): Promise<TAnalyzedContentMetadata> {
    const EMPTY = this.getEmptyMetadata();

    if (!content || typeof content !== "string") return EMPTY;

    // BOM/코드펜스 제거
    let c = content.trim();
    if (c.charCodeAt(0) === 0xfeff) c = c.slice(1);
    c = c.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const fb = c.indexOf("{"),
      lb = c.lastIndexOf("}");
    if (fb !== -1 && lb !== -1 && lb > fb) c = c.slice(fb, lb + 1);

    const safeParse = (s: string): unknown => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };

    const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
    const isStringArray = (v: unknown): v is string[] =>
      Array.isArray(v) && v.every((x) => typeof x === "string");

    let rawUnknown = safeParse(c);
    if (!rawUnknown) {
      const m = c.match(/\{[\s\S]*\}/);
      if (m) rawUnknown = safeParse(m[0]);
    }
    if (!isObject(rawUnknown)) {
      console.error("Failed to parse response as JSON:", content.slice(0, 200));
      return EMPTY;
    }

    // 유틸리티 함수들
    const toStrArr = (v: unknown): string[] => (isStringArray(v) ? v : []);
    const toBool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
    const toNum = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const toStr = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

    const normalizeTips = (v: unknown): TTravelTipItem[] => {
      if (Array.isArray(v) && v.every(isObject)) {
        return v
          .map(
            (it): TTravelTipItem => ({
              place: toStr(it.place, undefined as unknown as string),
              district: toStr(it.district, undefined as unknown as string),
              neighborhood: toStr(it.neighborhood, undefined as unknown as string),
              category: toStr(it.category, undefined as unknown as string),
              tips: toStrArr(it.tips),
            }),
          )
          .filter((it) => it.tips.length > 0);
      }
      if (isObject(v)) {
        const tips = toStrArr(v.tips);
        return tips.length
          ? [
              {
                place: toStr(v.place, undefined as unknown as string),
                district: toStr(v.district, undefined as unknown as string),
                neighborhood: toStr(v.neighborhood, undefined as unknown as string),
                category: toStr(v.category, undefined as unknown as string),
                tips,
              },
            ]
          : [];
      }
      if (isStringArray(v)) return v.length ? [{ tips: v }] : [];
      if (typeof v === "string" && v.trim()) return [{ tips: [v.trim()] }];
      return [];
    };

    const raw = rawUnknown as TLLMRaw;

    return {
      info_country: toStrArr(raw.info_country),
      info_city: toStrArr(raw.info_city),
      info_district: toStrArr(raw.info_district),
      info_neighborhood: toStrArr(raw.info_neighborhood),
      info_landmark: toStrArr(raw.info_landmark),
      info_category: toStrArr(raw.info_category),
      info_name: toStrArr(raw.info_name),
      info_special_tag: toStrArr(raw.info_special_tag),
      info_influencer: toStrArr(raw.info_influencer),
      info_season: toStrArr(raw.info_season),
      info_time_of_day: toStrArr(raw.info_time_of_day),
      info_activity_type: toStrArr(raw.info_activity_type),
      info_target_audience: toStrArr(raw.info_target_audience),
      info_reservation_required: toBool(raw.info_reservation_required, false),
      info_travel_tips: normalizeTips(raw.info_travel_tips),
      language: toStr(raw.language, "ko"),
      sentimentScore: toNum(raw.sentimentScore, 0.5),
      mainTopic: toStr(raw.mainTopic, ""),
      confidence_score: toNum(raw.confidence_score, 0.5),
    };
  }

  /**
   * System Prompt 생성
   */
  protected buildSystemPrompt(): string {
    return buildSystemPrompt({
      source: this.getSourceType(),
      countryHint: this.options.countryHint,
      maxPlaceTips: this.options.maxPlaceTips ?? 10,
    });
  }

  /**
   * User Prompt 생성
   */
  protected buildUserPrompt(content: string, title?: string, language: string = "ko"): string {
    return buildUserPrompt({
      source: this.getSourceType(),
      title,
      language,
      body: content,
    });
  }
}