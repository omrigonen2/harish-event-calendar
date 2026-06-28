import { connectDb, disconnectDb } from '../src/lib/db.js';
import env from '../src/config/env.js';
import User from '../src/models/User.js';
import Tenant from '../src/models/Tenant.js';
import TenantSettings from '../src/models/TenantSettings.js';
import Category from '../src/models/Category.js';
import Audience from '../src/models/Audience.js';
import EventCharacter from '../src/models/EventCharacter.js';
import Event from '../src/models/Event.js';
import PlatformSettings from '../src/models/PlatformSettings.js';
import { hashPassword } from '../src/services/authService.js';
import { createTenant } from '../src/services/tenantService.js';
import { HARISH_BRAND } from '../src/config/harishBrand.js';
import { PLATFORM_ROLES, TENANT_ROLES, EVENT_STATUS } from '../src/config/constants.js';
import { permissionsFromRole, editorDefaultPermissions } from '../src/lib/permissions.js';

const EVENT_CHARACTER_SEED = [
  {
    name: { he: 'כללי', en: 'General', es: 'General', ru: 'Общий' },
    sortOrder: 1,
  },
  {
    name: { he: 'תורני', en: 'Torah-based', es: 'Religioso', ru: 'Религиозный' },
    sortOrder: 2,
  },
  {
    name: { he: 'חרדי', en: 'Haredi', es: 'Jaredí', ru: 'Хареди' },
    sortOrder: 3,
  },
];

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function ensureEventCharacters(tenantId) {
  const characters = [];
  for (const spec of EVENT_CHARACTER_SEED) {
    let item = await EventCharacter.findOne({ tenantId, 'name.he': spec.name.he });
    if (item) {
      item = await EventCharacter.findByIdAndUpdate(
        item._id,
        { name: spec.name, sortOrder: spec.sortOrder },
        { new: true },
      );
      console.log(`Updated event character: ${spec.name.he}`);
    } else {
      item = await EventCharacter.create({ tenantId, name: spec.name, sortOrder: spec.sortOrder });
      console.log(`Created event character: ${spec.name.he}`);
    }
    characters.push(item);
  }

  const events = await Event.find({
    tenantId,
    $or: [{ eventCharacterIds: { $exists: false } }, { eventCharacterIds: { $size: 0 } }],
  });
  for (const event of events) {
    event.eventCharacterIds = [pickRandom(characters)._id];
    await event.save();
  }
  if (events.length) {
    console.log(`Assigned random event characters to ${events.length} event(s).`);
  }

  return characters;
}

async function applyHarishBranding(tenantId) {
  await Tenant.findByIdAndUpdate(tenantId, { name: HARISH_BRAND.name });
  await TenantSettings.findOneAndUpdate(
    { tenantId },
    {
      $set: {
        description: HARISH_BRAND.description,
        'colors.primary': HARISH_BRAND.colors.primary,
        'colors.secondary': HARISH_BRAND.colors.secondary,
        'seo.title': HARISH_BRAND.seo.title,
        'seo.description': HARISH_BRAND.seo.description,
        aiDefaultPrompt: HARISH_BRAND.aiDefaultPrompt,
      },
      // Language config is admin-controlled — only seed initial defaults on
      // first creation, never overwrite a saved choice on subsequent seeds.
      $setOnInsert: {
        defaultLanguage: 'he',
        supportedLanguages: ['he', 'en'],
      },
    },
    { upsert: true },
  );
  console.log('Applied Harish municipality branding (colors, SEO; languages preserved).');
}

async function ensureHarishUsers(tenantId) {
  const users = [
    {
      email: 'revital.g@harish.muni.il',
      name: 'רויטל ג.',
      password: '021374608',
      role: TENANT_ROLES.EDITOR,
      permissions: editorDefaultPermissions(),
    },
  ];

  for (const spec of users) {
    const normalized = spec.email.toLowerCase();
    let user = await User.findOne({ email: normalized });
    const passwordHash = await hashPassword(spec.password);
    const permissions = spec.permissions || permissionsFromRole(spec.role);

    if (user) {
      user.name = spec.name;
      user.passwordHash = passwordHash;
      user.active = true;
      user.inviteToken = null;
      user.inviteExpiresAt = null;
      const membership = user.tenantMemberships.find((m) => String(m.tenantId) === String(tenantId));
      if (membership) {
        membership.role = spec.role;
        membership.permissions = permissions;
        membership.active = true;
      } else {
        user.tenantMemberships.push({ tenantId, role: spec.role, permissions, active: true });
      }
      await user.save();
      console.log(`Updated Harish user: ${normalized} (${spec.role})`);
    } else {
      await User.create({
        email: normalized,
        name: spec.name,
        passwordHash,
        active: true,
        tenantMemberships: [{ tenantId, role: spec.role, permissions, active: true }],
      });
      console.log(`Created Harish user: ${normalized} (${spec.role})`);
    }
  }
}

async function main() {
  await connectDb();
  console.log('Seeding...');

  await PlatformSettings.findOneAndUpdate(
    { singleton: 'platform' },
    { $setOnInsert: { singleton: 'platform' } },
    { upsert: true, new: true },
  );

  let admin = await User.findOne({ email: env.seed.email.toLowerCase() });
  if (!admin) {
    admin = await User.create({
      email: env.seed.email.toLowerCase(),
      name: 'Platform Admin',
      passwordHash: await hashPassword(env.seed.password),
      platformRole: PLATFORM_ROLES.SUPER_ADMIN,
      active: true,
    });
    console.log(`Created super admin: ${admin.email}`);
  } else {
    console.log(`Super admin already exists: ${admin.email}`);
  }

  let tenant = await Tenant.findOne({ slug: 'harish' });
  if (!tenant) {
    tenant = await createTenant({ name: HARISH_BRAND.name, slug: 'harish' });
    await applyHarishBranding(tenant._id);
    console.log(`Created demo tenant: ${tenant.slug}`);

    const manager = await User.create({
      email: 'manager@harish.example',
      name: 'מנהל/ת דמו',
      passwordHash: await hashPassword('ChangeMe123!'),
      active: true,
      tenantMemberships: [
        {
          tenantId: tenant._id,
          role: TENANT_ROLES.MANAGER,
          permissions: permissionsFromRole(TENANT_ROLES.MANAGER),
          active: true,
        },
      ],
    });

    const categories = await Category.insertMany([
      { tenantId: tenant._id, name: { he: 'תרבות', en: 'Culture' }, color: '#1F54F4', sortOrder: 1 },
      { tenantId: tenant._id, name: { he: 'ספורט', en: 'Sports' }, color: '#00CA5C', sortOrder: 2 },
      { tenantId: tenant._id, name: { he: 'מוזיקה', en: 'Music' }, color: '#4268C1', sortOrder: 3 },
    ]);

    const audiences = await Audience.insertMany([
      { tenantId: tenant._id, name: { he: 'משפחות', en: 'Families' }, sortOrder: 1 },
      { tenantId: tenant._id, name: { he: 'מבוגרים', en: 'Adults' }, sortOrder: 2 },
    ]);

    const eventCharacters = await EventCharacter.insertMany(
      EVENT_CHARACTER_SEED.map((spec) => ({ tenantId: tenant._id, ...spec })),
    );

    const now = new Date();
    const inDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    await Event.insertMany([
      {
        tenantId: tenant._id,
        status: EVENT_STATUS.PUBLISHED,
        createdBy: manager._id,
        translations: {
          he: { title: 'פסטיבל קיץ', descriptionHtml: '<p>פסטיבל קיץ עירוני עם מוזיקה ואוכל.</p>' },
          en: { title: 'Summer Festival', descriptionHtml: '<p>A city summer festival with music and food.</p>' },
        },
        startAt: inDays(5),
        endAt: inDays(5),
        categoryIds: [categories[0]._id, categories[2]._id],
        audienceIds: [audiences[0]._id],
        eventCharacterIds: [pickRandom(eventCharacters)._id],
        pricing: { isFree: true, price: 0, currency: 'ILS' },
        publishedAt: now,
      },
      {
        tenantId: tenant._id,
        status: EVENT_STATUS.PUBLISHED,
        createdBy: manager._id,
        translations: {
          he: { title: 'מרוץ עירוני', descriptionHtml: '<p>מרוץ 10 ק"מ ברחבי העיר.</p>' },
          en: { title: 'City Run', descriptionHtml: '<p>A 10km run across the city.</p>' },
        },
        startAt: inDays(12),
        categoryIds: [categories[1]._id],
        audienceIds: [audiences[1]._id],
        eventCharacterIds: [pickRandom(eventCharacters)._id],
        pricing: { isFree: false, price: 50, currency: 'ILS' },
        publishedAt: now,
      },
      {
        tenantId: tenant._id,
        status: EVENT_STATUS.DRAFT,
        createdBy: manager._id,
        translations: {
          he: { title: 'ערב מוזיקה (טיוטה)', descriptionHtml: '<p>טיוטה.</p>' },
        },
        startAt: inDays(20),
        categoryIds: [categories[2]._id],
        audienceIds: [],
        eventCharacterIds: [pickRandom(eventCharacters)._id],
        pricing: { isFree: true, price: 0, currency: 'ILS' },
      },
    ]);

    console.log('Created demo categories, audiences, event characters, manager (manager@harish.example / ChangeMe123!), and events.');
  } else {
    await applyHarishBranding(tenant._id);
    console.log('Demo tenant already exists — refreshed Harish branding.');
  }

  await ensureEventCharacters(tenant._id);

  await ensureHarishUsers(tenant._id);

  console.log('Seed complete.');
  await disconnectDb();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
