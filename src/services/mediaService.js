import sharp from 'sharp';
import { nanoid } from 'nanoid';
import MediaAsset from '../models/MediaAsset.js';
import { putObject, deleteObject, getPresignedUrl } from '../lib/s3.js';
import { getS3Config, getPlatformMediaSettings } from './settingsService.js';
import { sha256Hex } from '../lib/crypto.js';
import {
  buildAspectSuggestion,
  checkEventCoverAspect,
  resolveEventCoverSettings,
} from '../lib/eventCoverAspect.js';

const MAX_DIMENSION = 2000;

// Optimize an uploaded image buffer: auto-rotate, downscale, convert to webp.
async function optimize(buffer) {
  const image = sharp(buffer).rotate();
  const meta = await image.metadata();
  const pipeline = image.resize({
    width: Math.min(meta.width || MAX_DIMENSION, MAX_DIMENSION),
    height: Math.min(meta.height || MAX_DIMENSION, MAX_DIMENSION),
    fit: 'inside',
    withoutEnlargement: true,
  });
  const output = await pipeline.webp({ quality: 82 }).toBuffer();
  const outMeta = await sharp(output).metadata();
  return { output, width: outMeta.width, height: outMeta.height };
}

async function readImageDimensions(buffer) {
  const meta = await sharp(buffer).rotate().metadata();
  return { width: meta.width || 0, height: meta.height || 0 };
}

export async function analyzeUploadAspect(buffer, coverSettings = null) {
  const settings = coverSettings || resolveEventCoverSettings({});
  const { width, height } = await readImageDimensions(buffer);
  const aspect = checkEventCoverAspect(width, height, settings);
  return buildAspectSuggestion(aspect, settings);
}

export async function uploadImage(tenant, userId, file, { folder = '', tags = [], coverSettings = null } = {}) {
  const settings = coverSettings || (await getPlatformMediaSettings());
  const aspectWarning = await analyzeUploadAspect(file.buffer, settings);
  const { output, width, height } = await optimize(file.buffer);
  const hash = sha256Hex(output);

  // Duplicate detection within the tenant.
  const existing = await MediaAsset.findOne({ tenantId: tenant._id, hash });
  if (existing) {
    return { asset: existing, duplicate: true, aspectWarning };
  }

  const key = `${tenant.slug}/media/${nanoid()}.webp`;
  const config = await getS3Config(tenant._id);
  await putObject(config, { key, body: output, contentType: 'image/webp' });

  const asset = await MediaAsset.create({
    tenantId: tenant._id,
    filename: file.originalname || 'image.webp',
    folder,
    tags,
    contentType: 'image/webp',
    width,
    height,
    size: output.length,
    s3Key: key,
    hash,
    uploadedBy: userId,
  });
  return { asset, duplicate: false, aspectWarning };
}

export async function listMedia(tenantId, { folder, q, userId } = {}) {
  const query = { tenantId };
  if (userId) query.uploadedBy = userId;
  if (folder) query.folder = folder;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ filename: rx }, { tags: rx }];
  }
  return MediaAsset.find(query).sort({ createdAt: -1 }).populate('uploadedBy', 'name email').lean();
}

export async function getAsset(tenantId, id, userId = null) {
  const query = { _id: id, tenantId };
  if (userId) query.uploadedBy = userId;
  return MediaAsset.findOne(query);
}

export async function urlFor(tenantId, id, userId = null) {
  const asset = await getAsset(tenantId, id, userId);
  if (!asset) return null;
  const config = await getS3Config(tenantId);
  return getPresignedUrl(config, asset.s3Key);
}

export async function urlForKey(tenantId, s3Key) {
  const config = await getS3Config(tenantId);
  return getPresignedUrl(config, s3Key);
}

export async function listFolders(tenantId, userId = null) {
  const query = { tenantId };
  if (userId) query.uploadedBy = userId;
  return MediaAsset.distinct('folder', query);
}

export async function deleteMedia(tenantId, id, userId = null) {
  const asset = await getAsset(tenantId, id, userId);
  if (!asset) return null;
  try {
    const config = await getS3Config(tenantId);
    await deleteObject(config, asset.s3Key);
  } catch {
    // Object may already be gone; proceed to remove the DB record.
  }
  await asset.deleteOne();
  return asset;
}

export async function updateMeta(tenantId, id, { folder, tags }, userId = null) {
  const query = { _id: id, tenantId };
  if (userId) query.uploadedBy = userId;
  return MediaAsset.findOneAndUpdate(
    query,
    { folder, tags },
    { new: true },
  );
}

export async function recordUsage(tenantId, mediaId, ref) {
  if (!mediaId) return;
  await MediaAsset.updateOne(
    { _id: mediaId, tenantId },
    { $addToSet: { usageRefs: ref } },
  );
}
