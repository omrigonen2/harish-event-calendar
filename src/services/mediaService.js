import sharp from 'sharp';
import { nanoid } from 'nanoid';
import MediaAsset from '../models/MediaAsset.js';
import { putObject, deleteObject, getPresignedUrl, getObjectBuffer } from '../lib/s3.js';
import { getS3Config, getPlatformMediaSettings, getOpenAIConfig } from './settingsService.js';
import { sha256Hex } from '../lib/crypto.js';
import { editImage } from '../lib/openai.js';
import {
  buildAspectSuggestion,
  buildAspectEditPrompt,
  checkEventCoverAspect,
  resolveEventCoverSettings,
  toOpenAiImageSize,
} from '../lib/eventCoverAspect.js';

const MAX_DIMENSION = 2000;

function aspectWarningForAsset(asset, aspectWarning) {
  if (!aspectWarning) return null;
  return {
    mediaId: String(asset._id),
    filename: asset.filename,
    ...aspectWarning,
  };
}

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

async function sampleEdgeBackground(buffer) {
  try {
    const { dominant } = await sharp(buffer).rotate().resize(16, 16, { fit: 'cover' }).stats();
    return {
      r: Math.round(dominant.r),
      g: Math.round(dominant.g),
      b: Math.round(dominant.b),
      alpha: 255,
    };
  } catch {
    return { r: 15, g: 15, b: 20, alpha: 255 };
  }
}

/** Fit AI output into exact 16:9 without cropping — letterbox with edge-matched background. */
async function normalizeEventCover(buffer, settings) {
  const tw = settings.targetWidth;
  const th = settings.targetHeight;
  const bg = await sampleEdgeBackground(buffer);
  const output = await sharp(buffer)
    .rotate()
    .resize(tw, th, { fit: 'contain', background: bg })
    .webp({ quality: 82 })
    .toBuffer();
  return { output, width: tw, height: th };
}

async function storeOptimizedImage(tenant, userId, file, { folder, tags, output, width, height }) {
  const hash = sha256Hex(output);
  const existing = await MediaAsset.findOne({ tenantId: tenant._id, hash });
  if (existing) {
    return { asset: existing, duplicate: true };
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
  return { asset, duplicate: false };
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
  const { asset, duplicate } = await storeOptimizedImage(tenant, userId, file, {
    folder,
    tags,
    output,
    width,
    height,
  });
  return {
    asset,
    duplicate,
    aspectWarning: aspectWarningForAsset(asset, aspectWarning),
  };
}

function aspectPreviewS3Key(tenant, assetId, previewId) {
  return `${tenant.slug}/media/_previews/${assetId}/${previewId}.webp`;
}

async function runAspectEdit(asset, tenant, { comment = '' } = {}) {
  const settings = await getPlatformMediaSettings();
  const aspect = checkEventCoverAspect(asset.width, asset.height, settings);
  const s3Config = await getS3Config(tenant._id);
  const openaiConfig = await getOpenAIConfig(tenant._id);
  const originalBuffer = await getObjectBuffer(s3Config, asset.s3Key);
  const pngBuffer = await sharp(originalBuffer).rotate().png().toBuffer();
  let prompt = buildAspectEditPrompt(aspect, settings);
  if (comment.trim()) {
    prompt += `\n\nAdditional instructions from the editor:\n${comment.trim()}`;
  }
  const size = toOpenAiImageSize(settings.targetWidth, settings.targetHeight);
  const editedBuffer = await editImage(openaiConfig, {
    model: settings.imageModel,
    imageBuffer: pngBuffer,
    prompt,
    size,
  });
  return normalizeEventCover(editedBuffer, settings);
}

export async function generateAspectPreview(tenant, assetId, userScope = null, { comment = '' } = {}) {
  const asset = await getAsset(tenant._id, assetId, userScope);
  if (!asset) return null;

  const { output, width, height } = await runAspectEdit(asset, tenant, { comment });
  const previewId = nanoid();
  const s3Config = await getS3Config(tenant._id);
  const key = aspectPreviewS3Key(tenant, assetId, previewId);
  await putObject(s3Config, { key, body: output, contentType: 'image/webp' });

  return {
    asset,
    previewId,
    previewKey: key,
    previewWidth: width,
    previewHeight: height,
  };
}

export async function getAspectPreviewBuffer(tenant, assetId, previewId, userScope = null) {
  const asset = await getAsset(tenant._id, assetId, userScope);
  if (!asset) return null;
  const s3Config = await getS3Config(tenant._id);
  const key = aspectPreviewS3Key(tenant, assetId, previewId);
  try {
    return await getObjectBuffer(s3Config, key);
  } catch {
    return null;
  }
}

export async function discardAspectPreview(tenant, assetId, previewId, userScope = null) {
  const asset = await getAsset(tenant._id, assetId, userScope);
  if (!asset) return null;
  const s3Config = await getS3Config(tenant._id);
  const key = aspectPreviewS3Key(tenant, assetId, previewId);
  try {
    await deleteObject(s3Config, key);
  } catch {
    // Preview may already be gone.
  }
  return { asset };
}

export async function applyAspectPreview(tenant, assetId, previewId, userScope = null) {
  const asset = await getAsset(tenant._id, assetId, userScope);
  if (!asset) return null;

  const s3Config = await getS3Config(tenant._id);
  const previewKey = aspectPreviewS3Key(tenant, assetId, previewId);
  const previewBuffer = await getObjectBuffer(s3Config, previewKey);
  const { output, width, height } = await optimize(previewBuffer);
  const newKey = `${tenant.slug}/media/${nanoid()}.webp`;
  await putObject(s3Config, { key: newKey, body: output, contentType: 'image/webp' });

  const oldKey = asset.s3Key;
  asset.width = width;
  asset.height = height;
  asset.size = output.length;
  asset.hash = sha256Hex(output);
  asset.s3Key = newKey;
  await asset.save();

  try {
    await deleteObject(s3Config, oldKey);
  } catch {
    // Best-effort cleanup.
  }
  try {
    await deleteObject(s3Config, previewKey);
  } catch {
    // Best-effort cleanup.
  }

  return { asset };
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