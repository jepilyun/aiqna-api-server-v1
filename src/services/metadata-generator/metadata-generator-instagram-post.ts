import { TSqlInstagramPostDetail } from "aiqna_common_v1";
import { BaseMetadataGenerator } from "./metadata-generator-base.js";

export class MetadataGeneratorInstagramPost extends BaseMetadataGenerator {
  protected getSourceType() {
    return "instagram" as const;
  }

  async generateMetadataFromInstagramPost(
    instagramPost: TSqlInstagramPostDetail,
    language: string = "ko",
  ): Promise<string | null> {
    let content = "";
    if (instagramPost.description) {
      content = instagramPost.description.substring(0, 8000);
    } else if (instagramPost.og_description) {
      content = instagramPost.og_description.substring(0, 8000);
    } else if (instagramPost.og_title) {
      content = instagramPost.og_title.substring(0, 8000);
    }

    return this.extractMetadata({
      content,
      language,
      identifier: instagramPost.instagram_post_url,
    });
  }
}