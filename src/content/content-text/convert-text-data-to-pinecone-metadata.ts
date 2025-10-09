import {
  TPineconeVectorMetadataForContent,
  TSqlTextDetail,
} from "aiqna_common_v1";

/**
 * convertTextDataToPineconeMetadata
 * TSqlTextDetail[]을 TPineconeText[]으로 변환
 * @param textData TSqlTextDetail
 * @returns
 */
export function convertTextDataToPineconeMetadata(
  textData: TSqlTextDetail,
): Partial<TPineconeVectorMetadataForContent> {
  return {
    title: textData.title ?? undefined, // Title
    content: textData.content, // Content
  };
}
