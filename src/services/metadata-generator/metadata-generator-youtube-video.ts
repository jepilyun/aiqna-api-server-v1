import { BaseMetadataGenerator } from "./metadata-generator-base.js";

export class MetadataGeneratorYouTubeVideo extends BaseMetadataGenerator {
  protected getSourceType() {
    return "youtube" as const;
  }

  async generateMetadataFromText(
    videoId: string,
    videoTitle: string,
    text: string,
    language: string = "ko",
  ): Promise<string | null> {
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) + "..." : text;

    return this.extractMetadata({
      content: truncatedText,
      title: videoTitle,
      language,
      identifier: videoId,
    });
  }
}