import mongoose from '../lib/db.js';
import { TENANT_STATUS } from '../config/constants.js';

const { Schema } = mongoose;

const tenantSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(TENANT_STATUS),
      default: TENANT_STATUS.ACTIVE,
      index: true,
    },
    domain: { type: String, default: '' },
  },
  { timestamps: true },
);

export default mongoose.model('Tenant', tenantSchema);
