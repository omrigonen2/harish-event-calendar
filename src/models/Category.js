import mongoose from '../lib/db.js';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: Map, of: String, default: {} }, // i18n: { he: '...', en: '...' }
    color: { type: String, default: '#64748b' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

categorySchema.index({ tenantId: 1, sortOrder: 1 });

export default mongoose.model('Category', categorySchema);
