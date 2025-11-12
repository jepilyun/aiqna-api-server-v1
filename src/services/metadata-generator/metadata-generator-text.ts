import { TSqlTextDetail } from "aiqna_common_v1";
import { BaseMetadataGenerator } from "./metadata-generator-base.js";

export class MetadataGeneratorText extends BaseMetadataGenerator {
  protected getSourceType() {
    return "text" as const;
  }

  async generateMetadataFromText(
    textData: TSqlTextDetail,
    language: string = "ko",
  ): Promise<string | null> {
    const content = textData.content ? textData.content.substring(0, 8000) : "";

    return this.extractMetadata({
      content,
      language,
      identifier: textData.hash_key.slice(0, 16),
    });
  }
}
