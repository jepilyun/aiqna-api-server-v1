import {
  IPineconeVectorMetadataForBlogPost,
  TSqlBlogPostDetail,
} from "aiqna_common_v1";

/**
 * generateVectorMetadataBlogPost
 * TSqlBlogPostDetail을 TPineconeVectorMetadataForContent으로 변환
 * @param blogPost TSqlBlogPostDetail
 * @returns
 */
export function generateVectorMetadataBlogPost(
  blogPost: TSqlBlogPostDetail,
): Partial<IPineconeVectorMetadataForBlogPost> {
  return {
    blog_post_url: blogPost.blog_post_url, // Instagram 게시물 URL
    title: blogPost.title, // Blog 제목
    text: blogPost.content ?? undefined, // Blog 내용
    image: blogPost.og_image ?? undefined, // Blog 이미지
    published_date: blogPost.published_date ?? undefined, // Blog 게시 날짜 (ISO 8601 형식)
    local_image_url: blogPost.local_image_url ?? undefined, // Blog 로컬 이미지 URL
    tags: blogPost.tags, // Blog 태그
    blog_platform: blogPost.platform, // Blog 플랫폼
    blog_platform_url: blogPost.platform_url, // Blog 플랫폼 URL
  };
}
