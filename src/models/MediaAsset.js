import mongoose from '../lib/db.js';

const { Schema } = mongoose;

const usageRefSchema = new Schema(
  {
    entityType: { type: String, required: true }, // 'event' | 'tenant'
    entityId: { type: Schema.Types.ObjectId, required: true },
    field: { type: String, default: '' }, // 'cover' | 'gallery' | 'logo'
  },
  { _id: false },
);

const mediaAssetSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    filename: { type: String, required: true },
    folder: { type: String, default: '', index: true },
    tags: { type: [String], default: [] },
    contentType: { type: String, default: 'image/jpeg' },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    size: { type: Number, default: 0 },
    s3Key: { type: String, required: true },
    hash: { type: String, default: '', index: true }, // SHA256 for duplicate detection
    usageRefs: { type: [usageRefSchema], default: [] },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

mediaAssetSchema.index({ tenantId: 1, folder: 1 });
mediaAssetSchema.index({ tenantId: 1, hash: 1 });

export default mongoose.model('MediaAsset', mediaAssetSchema);
