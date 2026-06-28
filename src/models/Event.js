import mongoose from '../lib/db.js';
import { EVENT_STATUS } from '../config/constants.js';

const { Schema } = mongoose;

const translationSchema = new Schema(
  {
    title: { type: String, default: '' },
    descriptionHtml: { type: String, default: '' },
  },
  { _id: false },
);

const eventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    status: {
      type: String,
      enum: Object.values(EVENT_STATUS),
      default: EVENT_STATUS.DRAFT,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // i18n content: Map of languageCode -> { title, descriptionHtml }
    translations: { type: Map, of: translationSchema, default: {} },

    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, default: null },
    allDay: { type: Boolean, default: false },

    audienceIds: [{ type: Schema.Types.ObjectId, ref: 'Audience' }],
    categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    eventCharacterIds: [{ type: Schema.Types.ObjectId, ref: 'EventCharacter' }],

    pricing: {
      isFree: { type: Boolean, default: true },
      price: { type: Number, default: 0 },
      currency: { type: String, default: 'ILS' },
    },

    coverMediaId: { type: Schema.Types.ObjectId, ref: 'MediaAsset', default: null },
    galleryMediaIds: [{ type: Schema.Types.ObjectId, ref: 'MediaAsset' }],

    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

eventSchema.index({ tenantId: 1, status: 1, startAt: 1 });
eventSchema.index({ tenantId: 1, categoryIds: 1 });
eventSchema.index({ tenantId: 1, audienceIds: 1 });
eventSchema.index({ tenantId: 1, eventCharacterIds: 1 });

// Resolve a title in the requested language, falling back to any available one.
eventSchema.methods.titleIn = function titleIn(lang, fallbackOrder = []) {
  const t = this.translations;
  const get = (code) => (t.get ? t.get(code) : t[code]);
  const primary = get(lang);
  if (primary && primary.title) return primary.title;
  for (const code of fallbackOrder) {
    const tr = get(code);
    if (tr && tr.title) return tr.title;
  }
  const keys = t.keys ? [...t.keys()] : Object.keys(t || {});
  for (const code of keys) {
    const tr = get(code);
    if (tr && tr.title) return tr.title;
  }
  return '(untitled)';
};

export default mongoose.model('Event', eventSchema);
