export const LANGUAGES = [
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE = 'he';

export function isRtl(code) {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? lang.dir === 'rtl' : false;
}

export const PLATFORM_ROLES = {
  SUPER_ADMIN: 'super_admin',
};

export const TENANT_ROLES = {
  MANAGER: 'manager',
  EDITOR: 'editor',
};

// Granular per-membership permissions (tenant level). `tenantManage` is the
// full-manager superset and implies all other permissions.
export const TENANT_PERMISSIONS = {
  EVENTS_WRITE: 'eventsWrite',
  EVENTS_PUBLISH: 'eventsPublish',
  EVENTS_SCOPE_ALL: 'eventsScopeAll',
  AI_MARKETING: 'aiMarketing',
  TENANT_MANAGE: 'tenantManage',
};

export const TENANT_PERMISSION_KEYS = Object.values(TENANT_PERMISSIONS);

export const EVENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

export const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
};

export const MARKETING_PLATFORMS = [
  'facebook',
  'instagram',
  'whatsapp',
  'newsletter',
  'website',
  'sms',
  'custom',
];

export const API_SCOPES = [
  'events:read',
  'events:write',
  'categories:read',
  'audiences:read',
  'eventCharacters:read',
  'users:read',
  'images:read',
  'translations:write',
  'calendar:read',
];

export const AUDIT_ACTIONS = {
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',
  EVENT_DELETED: 'event.deleted',
  EVENT_PUBLISHED: 'event.published',
  TRANSLATION_EXECUTED: 'translation.executed',
  MARKETING_GENERATED: 'marketing.generated',
  USER_INVITED: 'user.invited',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  CATEGORY_CREATED: 'category.created',
  CATEGORY_DELETED: 'category.deleted',
  AUDIENCE_CREATED: 'audience.created',
  AUDIENCE_DELETED: 'audience.deleted',
  EVENT_CHARACTER_CREATED: 'eventCharacter.created',
  EVENT_CHARACTER_DELETED: 'eventCharacter.deleted',
  SETTINGS_UPDATED: 'settings.updated',
  AI_CONFIG_CHANGED: 'ai_config.changed',
  TENANT_CREATED: 'tenant.created',
  TENANT_SUSPENDED: 'tenant.suspended',
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',
  TOKEN_CREATED: 'token.created',
  TOKEN_REVOKED: 'token.revoked',
};

export const NOTIFICATION_TYPES = {
  USER_INVITED: 'user_invited',
  EVENT_PUBLISHED: 'event_published',
  TRANSLATION_COMPLETED: 'translation_completed',
  MARKETING_COMPLETED: 'marketing_completed',
};
