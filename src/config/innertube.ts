import Innertube from "youtubei.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Innertube 클라이언트 생성
 */
const innertubeClient = await Innertube.create({
  cache: undefined,
  generate_session_locally: true,
});

export default innertubeClient;
