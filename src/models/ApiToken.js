import mongoose from '../lib/db.js';
import { API_SCOPES } from '../config/constants.js';

const { Schema } = mongoose;

const apiTokenSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, index: true }, // sha256 of raw token
    prefix: { type: String, default: '' }, // first chars for display
    scopes: { type: [String], enum: API_SCOPES, default: [] },
    webhookUrl: { type: String, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastUsedAt: { type: Date, default: null },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('ApiToken', apiTokenSchema);
