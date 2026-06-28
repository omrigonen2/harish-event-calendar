/**
 * Copy all collections from a source MongoDB URI to a destination URI.
 * Usage:
 *   SOURCE_URI=mongodb://127.0.0.1:27017/event-calendar \
 *   DEST_URI="mongodb+srv://..." \
 *   node scripts/db-sync.js
 */
import mongoose from 'mongoose';

const sourceUri = process.env.SOURCE_URI || 'mongodb://127.0.0.1:27017/event-calendar';
const destUri = process.env.DEST_URI || process.env.ATLAS_URI;

if (!destUri) {
  console.error('Missing DEST_URI (or ATLAS_URI) environment variable.');
  process.exit(1);
}

async function copyDatabase() {
  const source = mongoose.createConnection(sourceUri);
  const dest = mongoose.createConnection(destUri);

  await Promise.all([source.asPromise(), dest.asPromise()]);
  console.log('Connected to source and destination.');

  const collections = await source.db.listCollections().toArray();
  if (!collections.length) {
    console.log('Source database has no collections.');
    await source.close();
    await dest.close();
    return;
  }

  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;

    const docs = await source.db.collection(name).find({}).toArray();
    await dest.db.collection(name).deleteMany({});
    if (docs.length) {
      await dest.db.collection(name).insertMany(docs, { ordered: false });
    }
    console.log(`  ${name}: ${docs.length} document(s)`);
  }

  await source.close();
  await dest.close();
  console.log('Database sync complete.');
}

copyDatabase().catch((err) => {
  console.error('Database sync failed:', err);
  process.exit(1);
});
