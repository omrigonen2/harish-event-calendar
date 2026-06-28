import { connectDb, disconnectDb } from '../src/lib/db.js';
import PlatformSettings from '../src/models/PlatformSettings.js';
import Tenant from '../src/models/Tenant.js';
import TenantSettings from '../src/models/TenantSettings.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import Audience from '../src/models/Audience.js';
import EventCharacter from '../src/models/EventCharacter.js';
import Event from '../src/models/Event.js';
import MediaAsset from '../src/models/MediaAsset.js';
import AuditLog from '../src/models/AuditLog.js';
import Notification from '../src/models/Notification.js';
import ApiToken from '../src/models/ApiToken.js';

const MODELS = [
  PlatformSettings, Tenant, TenantSettings, User, Category,
  Audience, EventCharacter, Event, MediaAsset, AuditLog, Notification, ApiToken,
];

async function main() {
  await connectDb();
  console.log('Connected. Syncing indexes...');
  for (const Model of MODELS) {
    await Model.syncIndexes();
    console.log(`  indexes synced: ${Model.modelName}`);
  }

  // Ensure the singleton platform settings document exists.
  const existing = await PlatformSettings.findOne({ singleton: 'platform' });
  if (!existing) {
    await PlatformSettings.create({ singleton: 'platform' });
    console.log('Created PlatformSettings singleton.');
  }

  console.log('Migration complete.');
  await disconnectDb();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
