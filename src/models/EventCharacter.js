import mongoose from '../lib/db.js';

const { Schema } = mongoose;

const eventCharacterSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: Map, of: String, default: {} }, // i18n
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

eventCharacterSchema.index({ tenantId: 1, sortOrder: 1 });

export default mongoose.model('EventCharacter', eventCharacterSchema);
