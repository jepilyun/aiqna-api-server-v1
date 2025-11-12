import { TSqlBlogPostDetail } from "aiqna_common_v1";
import { BaseMetadataGenerator } from "./metadata-generator-base.js";

export class MetadataGeneratorBlogPost extends BaseMetadataGenerator {
  protected getSourceType() {
    return "blog" as const;
  }

  async generateMetadataFromBlogPost(
    blogPost: TSqlBlogPostDetail,
    language: string = "ko",
  ): Promise<string | null> {
    let content = "";
    if (blogPost.content) {
      content = blogPost.content.substring(0, 8000);
    } else if (blogPost.og_description) {
      content = blogPost.og_description.substring(0, 8000);
    } else if (blogPost.og_title) {
      content = blogPost.og_title.substring(0, 8000);
    }

    return this.extractMetadata({
      content,
      language,
      identifier: blogPost.blog_post_url,
    });
  }
}