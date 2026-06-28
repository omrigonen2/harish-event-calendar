/** Recommended event cover dimensions (16:9) used across public views. */
export const EVENT_COVER_TARGET_WIDTH = 1200;
export const EVENT_COVER_TARGET_HEIGHT = 675;
export const EVENT_COVER_TARGET_RATIO = EVENT_COVER_TARGET_WIDTH / EVENT_COVER_TARGET_HEIGHT;
export const EVENT_COVER_ASPECT_TOLERANCE = 0.08;
export const DEFAULT_EVENT_COVER_IMAGE_MODEL = 'gpt-image-1.5';

export const DEFAULT_EVENT_COVER_ASPECT_PROMPT = `Transform this image into a 16:9 landscape event cover ({targetWidth}×{targetHeight} px).

Rules:
- Do NOT crop, redraw, replace, or alter any existing content — all people, logos, artwork, and text must remain exactly as they appear.
- Do NOT change fonts, wording, or colors inside the original canvas.
- ONLY extend the canvas (outpaint) by adding seamless background on the sides or top/bottom until the aspect ratio is 16:9.
- Match lighting, texture, and color of the original edge pixels so extensions blend naturally.
- Keep the original composition centered; do not zoom, stretch, or distort.
- Ensure ALL text and logos remain fully visible — nothing may be cut off at any edge.

Current image: {width}×{height} px ({orientation}, ratio {ratio}).
Target: 16:9 ({targetWidth}×{targetHeight} px).`;
