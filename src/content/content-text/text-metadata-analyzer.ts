import { TSqlTextDetail } from "aiqna_common_v1";
import groq from "../../config/groq.js";
import openaiClient from "../../config/openai-client.js";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { withRetry } from "../../utils/retry/retry-common.js";
import { sleep } from "../../utils/sleep.js";

/**
 * Text Metadata Extractor with fallback support
 */
export class TextMetadataAnalyzerByAI {
  // 사용 가능한 모델 리스트 (우선순위 순)
  private models = [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "groq", model: "llama-3.1-70b-versatile" },
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openai", model: "gpt-4o-mini" },
  ];

  /**
   * Text에서 메타데이터 추출
   */
  async analyzeFromText(
    textData: TSqlTextDetail,
  ): Promise<TAnalyzedContentMetadata> {
    let content = "";

    if (textData.content) {
      content = textData.content.substring(0, 8000);
    }

    if (content.length === 0) {
      console.warn(
        `⚠️ No content available for ${textData.hash_key}`
      );
      return {
        categories: [],
        keywords: [],
        locations: [],
        names: [],
        confidence_score: 0,
      };
    }

    const prompt = this.buildPrompt(content);
    const systemPrompt = this.getSystemPrompt();

    // 각 모델을 순차적으로 시도
    for (let i = 0; i < this.models.length; i++) {
      const { provider, model } = this.models[i];

      try {
        console.log(
          `🔄 Trying ${provider}/${model} for ${textData.hash_key.slice(0, 16)}...`
        );

        // 재시도 로직과 함께 실행
        const result = await withRetry(
          async () => {
            if (provider === "groq") {
              return await this.analyzeWithGroq(systemPrompt, prompt, model);
            } else {
              return await this.analyzeWithOpenAI(
                systemPrompt,
                prompt,
                model
              );
            }
          },
          {
            maxRetries: 2,
            baseDelay: 15000,
            maxDelay: 60000,
            operationName: `Text metadata extraction (${provider}/${model})`,
            shouldRetry: (error) => {
              const errorMsg = (error as Error).message;
              return (
                errorMsg.includes("503") ||
                errorMsg.includes("over capacity") ||
                errorMsg.includes("internal_server_error")
              );
            },
          }
        );

        console.log(
          `✅ Successfully extracted metadata using ${provider}/${model}`
        );
        return result;
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.warn(
          `⚠️ ${provider}/${model} failed for ${textData.hash_key.slice(0, 16)}...: ${errorMsg}`
        );

        // 503이 아닌 다른 에러면 즉시 중단
        if (
          !errorMsg.includes("503") &&
          !errorMsg.includes("over capacity") &&
          !errorMsg.includes("internal_server_error")
        ) {
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
    console.error(
      `❌ All models failed for ${textData.hash_key.slice(0, 16)}..., returning empty metadata`
    );
    return {
      categories: [],
      keywords: [],
      locations: [],
      names: [],
      confidence_score: 0,
    };
  }

  /**
   * Groq API로 분석
   */
  private async analyzeWithGroq(
    systemPrompt: string,
    userPrompt: string,
    model: string
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model,
      temperature: 0.1,
      max_tokens: 2048,
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
    model: string
  ): Promise<TAnalyzedContentMetadata> {
    const completion = await openaiClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model,
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    return this.parseResponse(completion.choices[0].message.content);
  }

  /**
   * API 응답 파싱
   */
  private parseResponse(
    content: string | null | undefined
  ): TAnalyzedContentMetadata {
    try {
      const result = JSON.parse(content || "{}");
      return {
        categories: result.categories || [],
        keywords: result.keywords || [],
        locations: result.locations || [],
        names: result.names || [],
        confidence_score: result.confidence_score || 0.5,
      };
    } catch (error) {
      console.error("Failed to parse response:", error);
      return {
        categories: [],
        keywords: [],
        locations: [],
        names: [],
        confidence_score: 0,
      };
    }
  }

  /**
   * Get System Prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert at analyzing text content about Korean travel, food, and lifestyle.

Your task is to extract structured metadata from the text content.

Respond ONLY in valid JSON format:
{
  "categories": ["category1", "category2"],
  "keywords": ["keyword1", "keyword2"],
  "locations": ["location1", "location2"],
  "names": ["name1", "name2"],
  "confidence_score": 0.95
}

**Categories** (select ONLY from this list):
- "cafe" (카페, coffee shops)
- "restaurant" (음식점, 레스토랑)
- "shopping" (쇼핑, shopping malls, stores)
- "palace" (궁궐, palaces)
- "history" (역사, historical sites)
- "museum" (박물관, museums)
- "exhibition" (전시, exhibitions)
- "themepark" (테마파크, theme parks)
- "activity" (액티비티, activities)
- "experience" (체험, experiences)
- "festival" (축제, festivals)
- "market" (시장, traditional markets)
- "park" (공원, parks)
- "tour" (투어, tours)

**Keywords** (specific items mentioned):
- Food items: "pasta", "coffee", "dessert", "brunch"
- Activities: "hiking", "shopping", "photography"
- Attributes: "romantic", "family-friendly", "instagram-worthy"

**Locations** (specific place names):
- Neighborhoods: "삼청동", "강남", "홍대"
- Districts: "종로구", "강남구"
- Landmarks: "남산", "한강"
- Store/venue names: "스타벅스", "현대백화점"

**Names** (people, brands, products):
- Brand names
- Product names
- Celebrity/influencer names (if mentioned)

**Rules:**
1. Extract only information explicitly mentioned in the content
2. Use English for categories, original language for locations/names
3. Maximum 5 items per field
4. confidence_score: 0.0-1.0 based on clarity of information
5. If unsure, use empty array []`;
  }

  /**
   * Build Prompt
   */
  private buildPrompt(content: string): string {
    return `Text Content:
${content}

Extract metadata from this text content following the system instructions.
Return valid JSON only.`;
  }
}