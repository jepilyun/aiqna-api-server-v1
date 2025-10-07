import { TSqlInstagramPostDetail } from "aiqna_common_v1";
import groq from "../../../config/groq.js";
import { TAnalyzedContentMetadata } from "../../../types/shared.js";

/**
 * Video Metadata Extractor
 */
export class InstagramPostMetadataAnalyzerByAI {
  /**
   * 전체 Instagram 포스트에서 메타데이터 추출
   */
  async analyzeFromInstagramPost(
    instagramPost: TSqlInstagramPostDetail,
  ): Promise<TAnalyzedContentMetadata> {
    let content = "";

    if (instagramPost.content) {
      content = instagramPost.content.substring(0, 8000);
    } else if (instagramPost.og_description) {
      content = instagramPost.og_description.substring(0, 8000);
    } else if (instagramPost.og_title) {
      content = instagramPost.og_title.substring(0, 8000);
    }

    if (content.length === 0) {
      throw new Error("Content is empty");
    }

    const prompt = this.buildPrompt(content);

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt()
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile", // 또는 "llama-3.1-8b-instant"
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      
      return {
        categories: result.categories || [],
        keywords: result.keywords || [],
        locations: result.locations || [],
        names: result.names || [],
        confidence_score: result.confidence_score || 0.5
      };

    } catch (error) {
      console.error(`Metadata extraction failed for ${instagramPost.instagram_post_url}:`, error);
      
      // 실패 시 빈 메타데이터 반환
      return {
        categories: [],
        keywords: [],
        locations: [],
        names: [],
        confidence_score: 0
      };
    }
  }

  /**
   * Get System Prompt
   */
  private getSystemPrompt(): string {
    return `You are an expert at analyzing instagram content about Korean travel, food, and lifestyle content.

Your task is to extract structured metadata from the instagram content.

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
1. Extract only information explicitly mentioned in the transcript
2. Use English for categories, original language for locations/names
3. Maximum 5 items per field
4. confidence_score: 0.0-1.0 based on clarity of information
5. If unsure, use empty array []`;
  }

  /**
   * Build Prompt
   * @param content 
   * @returns 
   */
  private buildPrompt(content: string): string {
    return `Instagram Content: ${content}

Extract metadata from this instagram content following the system instructions.
Return valid JSON only.`;
  }
}