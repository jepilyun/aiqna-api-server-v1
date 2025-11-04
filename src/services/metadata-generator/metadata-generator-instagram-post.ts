import { TSqlInstagramPostDetail } from "aiqna_common_v1";
import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { sleep } from "../../utils/sleep.js";
import { buildSystemPrompt, buildUserPrompt, TGeneratorOptions } from "./build-prompt.js";
import { extractError } from "../../utils/extract-error.js";
import { isRetryable } from "../../utils/is-retryable.js";


/**
 * Metadata Generator for Instagram Post
 */
export class MetadataGeneratorInstagramPost {
  // 사용 가능한 모델 리스트 (우선순위 순)
  private models = [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openai", model: "gpt-4o-mini" },
  ];

  /** NEW: 옵션 주입 (source, countryHint, maxPlaceTips) */
  constructor(private readonly options: TGeneratorOptions = {}) {}

  /**
   * 전체 Instagram 포스트에서 메타데이터 추출
   */
  async generateMetadataFromInstagramPost(
    instagramPost: TSqlInstagramPostDetail,
    language: string = "ko",
  ): Promise<TAnalyzedContentMetadata> {
    // 콘텐츠 추출 (우선순위: description > og_description > og_title)
    let content = "";
    if (instagramPost.description) {
      content = instagramPost.description.substring(0, 8000);
    } else if (instagramPost.og_description) {
      content = instagramPost.og_description.substring(0, 8000);
    } else if (instagramPost.og_title) {
      content = instagramPost.og_title.substring(0, 8000);
    }

    if (content.length === 0) {
      console.warn(`⚠️ No content available for ${instagramPost.instagram_post_url}`);
      return this.getEmptyMetadata(language);
    }

    const prompt = this.buildPrompt(content, language);
    const systemPrompt = this.getSystemPrompt();

    // 각 모델을 순차적으로 시도
    for (let i = 0; i < this.models.length; i++) {
      const { provider, model } = this.models[i];

      try {
        console.log(`🔄 Trying ${provider}/${model} for ${instagramPost.instagram_post_url}`);

        // 재시도 로직과 함께 실행
        const result = await withRetry(
          async () => {
            if (provider === "groq") {
              return await this.analyzeWithGroq(systemPrompt, prompt, model);
            } else {
              return await this.analyzeWithOpenAI(systemPrompt, prompt, model);
            }
          },
          {
            maxRetries: 2,
            baseDelay: 15000,
            maxDelay: 60000,
            operationName: `Instagram metadata extraction (${provider}/${model})`,
            shouldRetry: (error) => {
              const { message, status, code } = extractError(error);
              return isRetryable(message, status, code);
            },
          },
        );

        console.log(`✅ Successfully extracted metadata using ${provider}/${model}`);
        return result;
      } catch (error) {
        const { message, status, code } = extractError(error);
        console.warn(`⚠️ ${provider}/${model} failed for ${instagramPost.instagram_post_url}: ${message}`);

        // 재시도 불가 에러면 즉시 중단
        if (!isRetryable(message, status, code)) {
          console.error(`❌ Non-retryable error, returning empty metadata`);
          break;
        }

        // 마지막 모델이 아니면 다음 모델 시도
        if (i < this.models.length - 1) {
          console.log(`🔄 Trying next model...`);
          await sleep(2000);
          continue;
        }
      }
    }

    // 모든 모델 실패 시 빈 메타데이터 반환
    console.error(`❌ All models failed for ${instagramPost.instagram_post_url}, returning empty metadata`);
    return this.getEmptyMetadata(language);
  }

  /**
   * 빈 메타데이터 반환 (중복 코드 제거)
   */
  private getEmptyMetadata(language: string = "ko"): TAnalyzedContentMetadata {
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
   * Groq API로 분석
   */
  private async analyzeWithGroq(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 3072, // 여유 증설
      response_format: { type: "json_object" },
    });

    return this.parseResponse(completion.choices[0].message.content);
  }

  /**
   * OpenAI API로 분석 (폴백)
   */
  private async analyzeWithOpenAI(
    systemPrompt: string,
    userPrompt: string,
    model: string,
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await openaiClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model,
      temperature: 0.1,
      max_tokens: 3072, // 여유 증설
      response_format: { type: "json_object" },
    });

    return this.parseResponse(completion.choices[0].message.content);
  }

  /**
   * API 응답 파싱 (```json fenced code block 가드 포함)
   */
  private parseResponse(content: string | null | undefined): TAnalyzedContentMetadata {
    try {
      const raw = content || "{}";
      let jsonText = raw;
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenced && fenced[1]) jsonText = fenced[1];

      const result = JSON.parse(jsonText);
      return {
        info_country: result.info_country || [],
        info_city: result.info_city || [],
        info_district: result.info_district || [],
        info_neighborhood: result.info_neighborhood || [],
        info_landmark: result.info_landmark || [],
        info_category: result.info_category || [],
        info_name: result.info_name || [],
        info_special_tag: result.info_special_tag || [],
        info_influencer: result.info_influencer || [],
        info_season: result.info_season || [],
        info_time_of_day: result.info_time_of_day || [],
        info_activity_type: result.info_activity_type || [],
        info_target_audience: result.info_target_audience || [],
        info_reservation_required: result.info_reservation_required || false,
        info_travel_tips: result.info_travel_tips || [],
        language: result.language || "ko",
        sentimentScore: result.sentimentScore || 0.5,
        mainTopic: result.mainTopic || "",
        confidence_score: result.confidence_score || 0.5,
      };
    } catch (error) {
      console.error("Failed to parse response:", error);
      return this.getEmptyMetadata();
    }
  }

  /** ====== 여기부터 변경 포인트: 공통 프롬프트 빌더 사용 ====== */
  private getSystemPrompt(): string {
    // source: "instagram" 고정, 나머지는 옵션 사용
    return buildSystemPrompt({
      source: this.options.source ?? "instagram",
      countryHint: this.options.countryHint,
      maxPlaceTips: this.options.maxPlaceTips ?? 10,
    });
  }

  private buildPrompt(content: string, language: string): string {
    return buildUserPrompt({
      source: this.options.source ?? "instagram",
      title: undefined, // 인스타는 별도 제목이 없는 경우가 많음
      language,
      body: content,
    });
  }
}
