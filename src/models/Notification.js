import mongoose from '../lib/db.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    type: { type: String, required: true },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    payload: { type: Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
    // Email delivery tracking
    emailRequested: { type: Boolean, default: false },
    emailSentAt: { type: Date, default: null },
    emailError: { type: String, default: '' },
    emailAttempts: { type: Number, default: 0 },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
