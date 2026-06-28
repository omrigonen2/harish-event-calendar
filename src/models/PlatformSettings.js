import mongoose from '../lib/db.js';
import {
  DEFAULT_EVENT_COVER_ASPECT_PROMPT,
  EVENT_COVER_ASPECT_TOLERANCE,
  EVENT_COVER_TARGET_HEIGHT,
  EVENT_COVER_TARGET_WIDTH,
  DEFAULT_EVENT_COVER_IMAGE_MODEL,
} from '../config/eventCover.js';

const { Schema } = mongoose;

// Singleton document holding all platform-wide integration secrets.
// Secret values are stored encrypted (see crypto.js); non-secret fields are plain.
const platformSettingsSchema = new Schema(
  {
    singleton: { type: String, default: 'platform', unique: true },
    s3: {
      endpoint: { type: String, default: '' },
      region: { type: String, default: 'us-east-1' },
      bucket: { type: String, default: '' },
      accessKeyId: { type: String, default: '' }, // encrypted
      secretAccessKey: { type: String, default: '' }, // encrypted
    },
    openai: {
      apiKey: { type: String, default: '' }, // encrypted
      defaultModel: { type: String, default: 'gpt-4o-mini' },
    },
    resend: {
      apiKey: { type: String, default: '' }, // encrypted
      fromEmail: { type: String, default: '' },
      fromName: { type: String, default: '' },
    },
    media: {
      eventCoverAspectPrompt: { type: String, default: DEFAULT_EVENT_COVER_ASPECT_PROMPT },
      eventCoverTargetWidth: { type: Number, default: EVENT_COVER_TARGET_WIDTH },
      eventCoverTargetHeight: { type: Number, default: EVENT_COVER_TARGET_HEIGHT },
      eventCoverAspectTolerance: { type: Number, default: EVENT_COVER_ASPECT_TOLERANCE },
      eventCoverImageModel: { type: String, default: DEFAULT_EVENT_COVER_IMAGE_MODEL },
    },
  },
  { timestamps: true },
);

export default mongoose.model('PlatformSettings', platformSettingsSchema);
