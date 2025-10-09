import Innertube from "youtubei.js";

/**
 * Innertube 클라이언트 생성
 */
const innertubeClient = await Innertube.create({
  cache: undefined,
  generate_session_locally: true,
});

export default innertubeClient;
