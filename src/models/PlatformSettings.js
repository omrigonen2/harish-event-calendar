import mongoose from '../lib/db.js';

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
  },
  { timestamps: true },
);

export default mongoose.model('PlatformSettings', platformSettingsSchema);
