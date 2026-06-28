import mongoose from '../lib/db.js';

const { Schema } = mongoose;

const shareLinkSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    filters: {
      from: { type: String, default: '' },
      to: { type: String, default: '' },
      category: { type: String, default: '' },
      audience: { type: String, default: '' },
      character: { type: String, default: '' },
      lang: { type: String, default: '' },
      view: { type: String, default: 'list' },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export default mongoose.model('ShareLink', shareLinkSchema);
