import groq from "../../config/groq.js";
import { TYouTubeVideoSummary } from "aiqna_common_v1";

/**
 * Groq Llama로 YouTube 자막 요약
 */
export async function summarizeYouTubeTranscript(
  transcript: string,
  videoTitle: string,
  language: string = "en",
): Promise<TYouTubeVideoSummary> {
  // 너무 긴 경우 앞부분만 사용 (토큰 제한)
  const maxChars = 20000; // 약 5000 토큰
  const truncatedTranscript =
    transcript.length > maxChars
      ? transcript.substring(0, maxChars) + "..."
      : transcript;

  const prompt = `
You are an expert at summarizing YouTube video transcripts.

Video Title: ${videoTitle}
Language: ${language}

Transcript:
${truncatedTranscript}

Please provide a structured summary in JSON format:
{
  "summary": "3-5 sentence overview of the entire video in English",
  "mainTopics": ["topic1", "topic2", "topic3"],
  "keyPoints": ["point1", "point2", "point3", "point4", "point5"],
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}

Focus on:
- Main concepts and ideas
- Practical takeaways
- Key terminology
- Important examples or case studies

IMPORTANT: 
- Respond in ENGLISH regardless of the transcript language
- Use simple, clear language
- Respond ONLY with valid JSON, no markdown formatting
- Ensure all arrays have at least 3 items
`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from Groq");
    }

    const result = JSON.parse(content);

    return {
      summary: result.summary || "",
      mainTopics: result.mainTopics || [],
      keyPoints: result.keyPoints || [],
      keywords: result.keywords || [],
    };
  } catch (error) {
    console.error("❌ Failed to summarize with Groq:", error);

    // Fallback: 기본값 반환
    return {
      summary: `Video about: ${videoTitle}`,
      mainTopics: [videoTitle],
      keyPoints: [],
      keywords: [],
    };
  }
}
