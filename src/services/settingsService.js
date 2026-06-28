import PlatformSettings from '../models/PlatformSettings.js';
import TenantSettings from '../models/TenantSettings.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { resolveEventCoverSettings } from '../lib/eventCoverAspect.js';

export async function getRawSettings() {
  let doc = await PlatformSettings.findOne({ singleton: 'platform' });
  if (!doc) {
    doc = await PlatformSettings.create({ singleton: 'platform' });
  }
  return doc;
}

async function getTenantIntegrations(tenantId) {
  if (!tenantId) return null;
  const settings = await TenantSettings.findOne({ tenantId });
  return settings?.integrations || null;
}

function pickOrFallback(tenantValue, platformValue) {
  return tenantValue !== undefined && tenantValue !== '' ? tenantValue : platformValue;
}

function pickSecret(tenantEncrypted, platformPlain) {
  const decrypted = decrypt(tenantEncrypted);
  return decrypted || platformPlain;
}

async function getPlatformS3Config() {
  const doc = await getRawSettings();
  return {
    endpoint: doc.s3.endpoint,
    region: doc.s3.region,
    bucket: doc.s3.bucket,
    accessKeyId: decrypt(doc.s3.accessKeyId),
    secretAccessKey: decrypt(doc.s3.secretAccessKey),
  };
}

async function getPlatformOpenAIConfig() {
  const doc = await getRawSettings();
  return {
    apiKey: decrypt(doc.openai.apiKey),
    defaultModel: doc.openai.defaultModel || 'gpt-4o-mini',
  };
}

async function getPlatformResendConfig() {
  const doc = await getRawSettings();
  return {
    apiKey: decrypt(doc.resend.apiKey),
    fromEmail: doc.resend.fromEmail,
    fromName: doc.resend.fromName,
  };
}

/** Resolved S3 config: platform default, optionally overridden per tenant. */
export async function getS3Config(tenantId = null) {
  const platform = await getPlatformS3Config();
  const tenant = await getTenantIntegrations(tenantId);
  if (!tenant?.s3?.override) return platform;
  return {
    endpoint: pickOrFallback(tenant.s3.endpoint, platform.endpoint),
    region: pickOrFallback(tenant.s3.region, platform.region),
    bucket: pickOrFallback(tenant.s3.bucket, platform.bucket),
    accessKeyId: pickSecret(tenant.s3.accessKeyId, platform.accessKeyId),
    secretAccessKey: pickSecret(tenant.s3.secretAccessKey, platform.secretAccessKey),
  };
}

/** Resolved OpenAI config: platform default, optionally overridden per tenant. */
export async function getOpenAIConfig(tenantId = null) {
  const platform = await getPlatformOpenAIConfig();
  const tenant = await getTenantIntegrations(tenantId);
  if (!tenant?.openai?.override) return platform;
  return {
    apiKey: pickSecret(tenant.openai.apiKey, platform.apiKey),
    defaultModel: platform.defaultModel,
  };
}

/** Resolved Resend config: platform default, optionally overridden per tenant. */
export async function getResendConfig(tenantId = null) {
  const platform = await getPlatformResendConfig();
  const tenant = await getTenantIntegrations(tenantId);
  if (!tenant?.resend?.override) return platform;
  return {
    apiKey: pickSecret(tenant.resend.apiKey, platform.apiKey),
    fromEmail: pickOrFallback(tenant.resend.fromEmail, platform.fromEmail),
    fromName: pickOrFallback(tenant.resend.fromName, platform.fromName),
  };
}

export async function getPlatformMediaSettings() {
  const doc = await getRawSettings();
  return resolveEventCoverSettings(doc.media || {});
}

export async function getMaskedSettings() {
  const doc = await getRawSettings();
  const has = (v) => Boolean(v);
  const media = resolveEventCoverSettings(doc.media || {});
  return {
    s3: {
      endpoint: doc.s3.endpoint,
      region: doc.s3.region,
      bucket: doc.s3.bucket,
      hasAccessKeyId: has(doc.s3.accessKeyId),
      hasSecretAccessKey: has(doc.s3.secretAccessKey),
    },
    openai: {
      hasApiKey: has(doc.openai.apiKey),
      defaultModel: doc.openai.defaultModel || 'gpt-4o-mini',
    },
    resend: {
      hasApiKey: has(doc.resend.apiKey),
      fromEmail: doc.resend.fromEmail,
      fromName: doc.resend.fromName,
    },
    media: {
      eventCoverAspectPrompt: media.aspectPrompt,
      eventCoverTargetWidth: media.targetWidth,
      eventCoverTargetHeight: media.targetHeight,
      eventCoverAspectTolerance: media.aspectTolerance,
    },
  };
}

export async function getMaskedTenantIntegrations(tenantId) {
  const settings = await TenantSettings.findOne({ tenantId });
  const integrations = settings?.integrations || {};
  const has = (v) => Boolean(v);

  return {
    s3: {
      override: Boolean(integrations.s3?.override),
      endpoint: integrations.s3?.endpoint || '',
      region: integrations.s3?.region || '',
      bucket: integrations.s3?.bucket || '',
      hasAccessKeyId: has(integrations.s3?.accessKeyId),
      hasSecretAccessKey: has(integrations.s3?.secretAccessKey),
    },
    openai: {
      override: Boolean(integrations.openai?.override),
      hasApiKey: has(integrations.openai?.apiKey),
    },
    resend: {
      override: Boolean(integrations.resend?.override),
      hasApiKey: has(integrations.resend?.apiKey),
      fromEmail: integrations.resend?.fromEmail || '',
      fromName: integrations.resend?.fromName || '',
    },
  };
}

export async function resolvePreferredModel(tenantId, tenantSettings = null) {
  if (tenantSettings?.aiPreferredModel) return tenantSettings.aiPreferredModel;
  const platform = await getPlatformOpenAIConfig();
  return platform.defaultModel || 'gpt-4o-mini';
}

export async function updateSettings(section, values) {
  const doc = await getRawSettings();
  if (section === 's3') {
    doc.s3.endpoint = values.endpoint ?? doc.s3.endpoint;
    doc.s3.region = values.region ?? doc.s3.region;
    doc.s3.bucket = values.bucket ?? doc.s3.bucket;
    if (values.accessKeyId) doc.s3.accessKeyId = encrypt(values.accessKeyId);
    if (values.secretAccessKey) doc.s3.secretAccessKey = encrypt(values.secretAccessKey);
  } else if (section === 'openai') {
    if (values.apiKey) doc.openai.apiKey = encrypt(values.apiKey);
    if (values.defaultModel !== undefined) doc.openai.defaultModel = values.defaultModel;
  } else if (section === 'resend') {
    doc.resend.fromEmail = values.fromEmail ?? doc.resend.fromEmail;
    doc.resend.fromName = values.fromName ?? doc.resend.fromName;
    if (values.apiKey) doc.resend.apiKey = encrypt(values.apiKey);
  } else if (section === 'media') {
    if (values.eventCoverAspectPrompt !== undefined) {
      doc.media.eventCoverAspectPrompt = values.eventCoverAspectPrompt;
    }
    if (values.eventCoverTargetWidth !== undefined) {
      doc.media.eventCoverTargetWidth = Number(values.eventCoverTargetWidth) || doc.media.eventCoverTargetWidth;
    }
    if (values.eventCoverTargetHeight !== undefined) {
      doc.media.eventCoverTargetHeight = Number(values.eventCoverTargetHeight) || doc.media.eventCoverTargetHeight;
    }
    if (values.eventCoverAspectTolerance !== undefined) {
      const tol = Number(values.eventCoverAspectTolerance);
      if (!Number.isNaN(tol) && tol > 0 && tol < 1) {
        doc.media.eventCoverAspectTolerance = tol;
      }
    }
  }
  await doc.save();
  return doc;
}

export async function updateTenantIntegrations(tenantId, section, values) {
  const settings = await TenantSettings.findOne({ tenantId });
  if (!settings) throw new Error('Tenant settings not found');

  const override = values.override === 'on' || values.override === true || values.override === 'true';

  if (section === 's3') {
    settings.integrations.s3.override = override;
    if (override) {
      settings.integrations.s3.endpoint = values.endpoint ?? settings.integrations.s3.endpoint;
      settings.integrations.s3.region = values.region ?? settings.integrations.s3.region;
      settings.integrations.s3.bucket = values.bucket ?? settings.integrations.s3.bucket;
      if (values.accessKeyId) settings.integrations.s3.accessKeyId = encrypt(values.accessKeyId);
      if (values.secretAccessKey) {
        settings.integrations.s3.secretAccessKey = encrypt(values.secretAccessKey);
      }
    }
  } else if (section === 'openai') {
    settings.integrations.openai.override = override;
    if (override && values.apiKey) {
      settings.integrations.openai.apiKey = encrypt(values.apiKey);
    }
  } else if (section === 'resend') {
    settings.integrations.resend.override = override;
    if (override) {
      settings.integrations.resend.fromEmail = values.fromEmail ?? settings.integrations.resend.fromEmail;
      settings.integrations.resend.fromName = values.fromName ?? settings.integrations.resend.fromName;
      if (values.apiKey) settings.integrations.resend.apiKey = encrypt(values.apiKey);
    }
  }

  await settings.save();
  return settings;
}

export async function clearTenantIntegrationOverride(tenantId, section) {
  const settings = await TenantSettings.findOne({ tenantId });
  if (!settings) throw new Error('Tenant settings not found');

  if (section === 's3') {
    settings.integrations.s3.override = false;
    settings.integrations.s3.endpoint = '';
    settings.integrations.s3.region = '';
    settings.integrations.s3.bucket = '';
    settings.integrations.s3.accessKeyId = '';
    settings.integrations.s3.secretAccessKey = '';
  } else if (section === 'openai') {
    settings.integrations.openai.override = false;
    settings.integrations.openai.apiKey = '';
  } else if (section === 'resend') {
    settings.integrations.resend.override = false;
    settings.integrations.resend.apiKey = '';
    settings.integrations.resend.fromEmail = '';
    settings.integrations.resend.fromName = '';
  }

  await settings.save();
  return settings;
}
