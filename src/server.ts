import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { extractVideoId } from "./utils-youtube/extract-video-id.js";
import { Innertube } from "youtubei.js";
import { decodeHtmlEntities } from "./utils/decode-html-entities.js";
import { AnySegment, extractTextFromSegment, isCueGroupSegment, isGenericSegment, isTranscriptSegment } from "./utils-youtube/extract-transcript-segment.js";


dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3100",
      "http://localhost:3101",
      "http://localhost:3102",
      "http://localhost:3103",
      "http://localhost:3104",
      "http://localhost:3105",
    ], // 프론트엔드 주소
    credentials: true, // 🔥 쿠키 허용
  }),
);
app.use(express.json());

/**
 * API Admin Administrators Routes
 * list, create, detailGet, detailUpdate, detailDelete
 */
// app.use("/api/admin/administrator", routesAdminAdministrator);
// Routes for User Frontend
// app.use("/api/event", routesUserEvent);

app.get("/", async (req, res) => {
  try {
    // --- Rate Limiting Start ---
    // Use the client's IP address as the key for rate limiting
    // Get IP from various possible headers, fallback to connection remote address
    const ipAddress = req.headers['cf-connecting-ip'] || 
      req.headers['x-forwarded-for'] || 
      req.headers['x-real-ip'] || 
      req.connection.remoteAddress || 
      req.socket.remoteAddress || 
      'unknown-ip';

    console.log("ipAddress =====>", ipAddress);

    // Note: You'll need to implement rate limiting middleware for Express
    // Example using express-rate-limit:
    // const rateLimit = require('express-rate-limit');
    // const limiter = rateLimit({
    //   windowMs: 60 * 1000, // 1 minute
    //   max: 100, // limit each IP to 100 requests per windowMs
    //   message: { error: "Rate limit exceeded. Please try again in a minute." }
    // });
    
    // For now, we'll skip rate limiting implementation
    // You can add it as middleware: app.use('/', limiter);
    // --- Rate Limiting End ---

    // Get video ID from query parameters
    const videoUrlOrId = req.query.id;

    if (!videoUrlOrId) {
      return res.status(400).json({ 
        error: "Video ID or URL is required (query param: 'id')" 
      });
    }

    // Extract video ID using the helper function
    const videoId = extractVideoId(videoUrlOrId as string);

    console.log("videoId =====>", videoId);

    if (!videoId) {
      return res.status(400).json({ 
        error: "Invalid YouTube Video ID or URL format" 
      });
    }

    console.log(`Fetching transcript for video ID: ${videoId}`);
    
    // Create YouTube instance
    // const youtube = await Innertube.create({
    //   fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    //     // Request 객체인 경우 URL로 변환
    //     if (input instanceof Request) {
    //       return globalThis.fetch(input.url, init);
    //     }
    //     return globalThis.fetch(input, init);
    //   }
    // });
    const youtube = await Innertube.create();

    // Get video info
    const info = await youtube.getInfo(videoId);
    console.log(info);
    
    const videoTitle = info.basic_info?.title || 'Untitled Video';
    const transcriptData = await info.getTranscript();

    // Check if transcript data exists
    if (!transcriptData || 
        !transcriptData.transcript || 
        !transcriptData.transcript.content || 
        !transcriptData.transcript.content.body || 
        !transcriptData.transcript.content.body.initial_segments) {
      return res.status(404).json({ 
        videoTitle, 
        error: "No transcript available for this video." 
      });
    }

    // Process transcript segments
    const segments = transcriptData.transcript.content.body.initial_segments || [];
    const formattedTranscript = segments.map((segment: AnySegment) => {
      let text = '';
      let offset = 0;
      let duration = 0;

      // 타입 가드를 사용한 안전한 처리
      if (isTranscriptSegment(segment)) {
        const tsr = segment.transcript_segment_renderer; // 이제 타입이 올바르게 추론됨
        text = decodeHtmlEntities(extractTextFromSegment(tsr));
        offset = parseFloat(tsr.start_ms || '0') / 1000;
        duration = (parseFloat(tsr.end_ms || '0') - parseFloat(tsr.start_ms || '0')) / 1000;
      } else if (isCueGroupSegment(segment)) {
        const cue = segment.cue_group_renderer.cues?.[0]?.cue_renderer;
        if (cue) {
          text = decodeHtmlEntities(extractTextFromSegment(cue));
          offset = parseFloat(cue.start_offset_ms || '0') / 1000;
          duration = parseFloat(cue.duration_ms || '0') / 1000;
        }
      } else if (isGenericSegment(segment)) {
        text = decodeHtmlEntities(extractTextFromSegment(segment));
        offset = 0;
        duration = 0;
        
        if (segment.start_ms && typeof segment.start_ms === 'string') {
          offset = parseFloat(segment.start_ms) / 1000;
        }
        if (segment.duration_ms && typeof segment.duration_ms === 'string') {
          duration = parseFloat(segment.duration_ms) / 1000;
        } else if (segment.end_ms && typeof segment.end_ms === 'string' && 
          segment.start_ms && typeof segment.start_ms === 'string') {
          duration = (parseFloat(segment.end_ms) - parseFloat(segment.start_ms)) / 1000;
        }
      }
      
      return { text, offset, duration };
    }).filter((s) => s.text); // Filter out empty text segments

    // Return successful response
    return res.json({ 
      videoTitle: decodeHtmlEntities(videoTitle), 
      transcript: formattedTranscript 
    });

  } catch (error: unknown) {
    // Error handling
    const err = error as Error;
    console.error(`Error fetching transcript for ${req.query.id}:`, err.message, err.stack);
    
    let errorMessage = "Failed to fetch transcript.";
    let statusCode = 500;

    // Handle specific error types
    if (err instanceof SyntaxError && err.message.includes("JSON")) {
      errorMessage = "Failed to process data from YouTube. The API response may be malformed or incomplete.";
    } else if (err.message.includes('private') || 
      err.message.includes('unavailable') || 
      err.message.includes('premiere') || 
      err.message.includes('live')) {
      errorMessage = "Video is private, unavailable, a live stream, or a premiere without a processed transcript.";
      statusCode = 403;
    } else if (err.message.includes('অঞ্চলের কারণে') || 
      err.message.includes('region-locked')) {
      errorMessage = "The video is region-locked and unavailable.";
      statusCode = 451; // Unavailable For Legal Reasons
    } else if (err.message.includes('Transcripts are not available for this video')) {
      errorMessage = "Transcripts are not available for this video.";
      statusCode = 404;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage, 
      videoId: req.query.id 
    });
  }
});


const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// server.js 내부에 이런 코드가 있는지 확인해보세요
