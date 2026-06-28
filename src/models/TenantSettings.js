import mongoose from '../lib/db.js';
import { DEFAULT_LANGUAGE, LANGUAGE_CODES } from '../config/constants.js';

const { Schema } = mongoose;

const tenantSettingsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },
    description: { type: String, default: '' },
    logoMediaId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
    colors: {
      primary: { type: String, default: '#2563eb' },
      secondary: { type: String, default: '#1e293b' },
    },
    defaultLanguage: { type: String, enum: LANGUAGE_CODES, default: DEFAULT_LANGUAGE },
    supportedLanguages: { type: [String], default: [DEFAULT_LANGUAGE, 'en'] },
    timezone: { type: String, default: 'Asia/Jerusalem' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
    },
    aiDefaultPrompt: {
      type: String,
      default:
        'You are the official marketing assistant for this organization. Generate engaging, accurate community announcements while maintaining an official tone.',
    },
    aiPreferredModel: { type: String, default: 'gpt-4o-mini' },
    autoTranslateOnSave: { type: Boolean, default: true },

    // Optional per-tenant integration overrides (super-admin only).
    // When override is false, platform defaults from Platform Settings are used.
    integrations: {
      s3: {
        override: { type: Boolean, default: false },
        endpoint: { type: String, default: '' },
        region: { type: String, default: '' },
        bucket: { type: String, default: '' },
        accessKeyId: { type: String, default: '' }, // encrypted
        secretAccessKey: { type: String, default: '' }, // encrypted
      },
      openai: {
        override: { type: Boolean, default: false },
        apiKey: { type: String, default: '' }, // encrypted
      },
      resend: {
        override: { type: Boolean, default: false },
        apiKey: { type: String, default: '' }, // encrypted
        fromEmail: { type: String, default: '' },
        fromName: { type: String, default: '' },
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model('TenantSettings', tenantSettingsSchema);
