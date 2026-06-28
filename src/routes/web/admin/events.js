import express from 'express';
import { translate } from '../../../lib/ui-i18n.js';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { eventScope, requirePermission } from '../../../middleware/requireRole.js';
import * as eventService from '../../../services/eventService.js';
import { listCategories, listAudiences, listEventCharacters } from '../../../services/taxonomyService.js';
import { listTenantUsers } from '../../../services/userService.js';
import { recordUsage } from '../../../services/mediaService.js';
import { notify } from '../../../services/notificationService.js';
import { audit } from '../../../services/auditService.js';
import User from '../../../models/User.js';
import {
  AUDIT_ACTIONS,
  EVENT_STATUS,
  NOTIFICATION_TYPES,
  TENANT_ROLES,
  TENANT_PERMISSIONS,
} from '../../../config/constants.js';
import { templates } from '../../../services/emailService.js';
import env from '../../../config/env.js';

const router = express.Router({ mergeParams: true });

function adminBase(req) {
  return `/admin/${req.tenant.slug}`;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = eventScope(req);
    const filters = {
      status: req.query.status,
      category: req.query.category,
      audience: req.query.audience,
      character: req.query.character,
      creator: req.query.creator,
      price: req.query.price,
      from: req.query.from,
      to: req.query.to,
      q: req.query.q,
    };
    const sort = req.query.sort || 'newest';
    const page = parseInt(req.query.page || '1', 10);
    const result = await eventService.listEvents(req.tenant._id, {
      filters,
      sort,
      scopeUserId: scope,
      page,
      tenantSettings: req.tenantSettings,
    });
    const canSeeAll = scope === null;
    const [categories, audiences, eventCharacters, users] = await Promise.all([
      listCategories(req.tenant._id),
      listAudiences(req.tenant._id),
      listEventCharacters(req.tenant._id),
      canSeeAll ? listTenantUsers(req.tenant._id) : [],
    ]);
    res.render('admin/events/list', {
      title: 'Events',
      activeNav: 'events',
      result,
      categories,
      audiences,
      eventCharacters,
      users,
      filters,
      sort,
      eventService,
    });
  }),
);

const fillMissingHandler = asyncHandler(async (req, res) => {
  const scope = eventScope(req);
  const uiLang = req.tenantSettings.defaultLanguage;
  const { updated } = await eventService.fillMissingEventTranslations(
    req.tenant._id,
    req.tenantSettings,
    scope,
  );
  if (updated) {
    req.flash('success', translate('flash.eventsMissingFilled', uiLang, { count: updated }));
  } else {
    req.flash('info', translate('flash.taxonomyNothingMissing', uiLang));
  }
  const base = adminBase(req);
  let returnTo = req.body.returnTo || req.query.returnTo || `${base}/events`;
  if (!returnTo.startsWith(base)) returnTo = `${base}/events`;
  res.redirect(returnTo);
});

// Accept GET and POST so direct navigation and the list-page form both work.
router.get(
  '/fill-missing',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  fillMissingHandler,
);
router.post(
  '/fill-missing',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  fillMissingHandler,
);

router.get(
  '/new',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  asyncHandler(async (req, res) => {
    const [categories, audiences, eventCharacters] = await Promise.all([
      listCategories(req.tenant._id),
      listAudiences(req.tenant._id),
      listEventCharacters(req.tenant._id),
    ]);
    res.render('admin/events/form', {
      title: 'New event',
      activeNav: 'events',
      event: null,
      categories,
      audiences,
      eventCharacters,
    });
  }),
);

router.post(
  '/',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  asyncHandler(async (req, res) => {
    const langs = req.tenantSettings.supportedLanguages;
    const uiLang = req.tenantSettings.defaultLanguage;
    try {
      const event = await eventService.createEvent(
        req.tenant._id,
        req.user._id,
        req.body,
        req.tenantSettings,
        eventScope(req),
      );
      await recordUsage(req.tenant._id, event.coverMediaId, {
        entityType: 'event',
        entityId: event._id,
        field: 'cover',
      });
      await audit({
        tenantId: req.tenant._id,
        actor: req.user,
        action: AUDIT_ACTIONS.EVENT_CREATED,
        entityType: 'event',
        entityId: event._id,
      });
      req.flash('success', translate('events.created', uiLang));
      return res.redirect(`${adminBase(req)}/events/${event._id}/edit`);
    } catch (err) {
      req.flash('error', translate('flash.eventSaveFailed', uiLang, { message: err.message }));
      return res.redirect(`${adminBase(req)}/events/new`);
    }
  }),
);

router.get(
  '/:id/edit',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  asyncHandler(async (req, res) => {
    const event = await eventService.getEvent(req.tenant._id, req.params.id, eventScope(req));
    if (!event) return res.status(404).render('errors/404', { title: 'Not found' });
    const [categories, audiences, eventCharacters] = await Promise.all([
      listCategories(req.tenant._id),
      listAudiences(req.tenant._id),
      listEventCharacters(req.tenant._id),
    ]);
    res.render('admin/events/form', {
      title: 'Edit event',
      activeNav: 'events',
      event,
      categories,
      audiences,
      eventCharacters,
    });
  }),
);

router.post(
  '/:id',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  asyncHandler(async (req, res) => {
    const langs = req.tenantSettings.supportedLanguages;
    const uiLang = req.tenantSettings.defaultLanguage;
    try {
      const existing = await eventService.getEvent(req.tenant._id, req.params.id, eventScope(req));
      const beforeMissing = existing ? eventService.missingLanguages(existing, langs).length : 0;
      const event = await eventService.updateEvent(
        req.tenant._id,
        req.params.id,
        req.user._id,
        req.body,
        eventScope(req),
        req.tenantSettings,
      );
      if (!event) return res.status(404).render('errors/404', { title: 'Not found' });
      await recordUsage(req.tenant._id, event.coverMediaId, {
        entityType: 'event',
        entityId: event._id,
        field: 'cover',
      });
      await audit({
        tenantId: req.tenant._id,
        actor: req.user,
        action: AUDIT_ACTIONS.EVENT_UPDATED,
        entityType: 'event',
        entityId: event._id,
      });
      const afterMissing = eventService.missingLanguages(event, langs).length;
      if (beforeMissing > afterMissing && req.tenantSettings.autoTranslateOnSave !== false) {
        req.flash('success', translate('events.savedWithTranslate', uiLang));
      } else {
        req.flash('success', translate('events.saved', uiLang));
      }
      return res.redirect(`${adminBase(req)}/events/${event._id}/edit`);
    } catch (err) {
      req.flash('error', translate('flash.eventSaveFailed', uiLang, { message: err.message }));
      return res.redirect(`${adminBase(req)}/events/${req.params.id}/edit`);
    }
  }),
);

router.post(
  '/:id/status',
  requirePermission(TENANT_PERMISSIONS.EVENTS_PUBLISH),
  asyncHandler(async (req, res) => {
    const uiLang = req.tenantSettings.defaultLanguage;
    const status = req.body.status;
    if (!Object.values(EVENT_STATUS).includes(status)) {
      return res.status(400).render('errors/404', { title: 'Invalid' });
    }
    const event = await eventService.setStatus(req.tenant._id, req.params.id, status, eventScope(req));
    if (!event) return res.status(404).render('errors/404', { title: 'Not found' });

    await audit({
      tenantId: req.tenant._id,
      actor: req.user,
      action: status === EVENT_STATUS.PUBLISHED ? AUDIT_ACTIONS.EVENT_PUBLISHED : AUDIT_ACTIONS.EVENT_UPDATED,
      entityType: 'event',
      entityId: event._id,
      metadata: { status },
    });

    // Notify managers when an event is published.
    if (status === EVENT_STATUS.PUBLISHED) {
      const title = event.titleIn(req.tenantSettings.defaultLanguage);
      const eventUrl = `${env.appBaseUrl}/c/${req.tenant.slug}/events/${event._id}`;
      const managers = await User.find({
        tenantMemberships: {
          $elemMatch: {
            tenantId: req.tenant._id,
            active: true,
            $or: [
              { 'permissions.tenantManage': true },
              { permissions: { $exists: false }, role: TENANT_ROLES.MANAGER },
            ],
          },
        },
      }).lean();
      for (const m of managers) {
        await notify({
          userId: m._id,
          tenantId: req.tenant._id,
          type: NOTIFICATION_TYPES.EVENT_PUBLISHED,
          title: 'Event published',
          body: title,
          link: `${adminBase(req)}/events/${event._id}/edit`,
          email: {
            to: m.email,
            ...templates.eventPublished({ tenantName: req.tenant.name, eventTitle: title, eventUrl }),
          },
        });
      }
    }

    req.flash('success', translate('flash.eventStatus', uiLang, { status: translate(`status.${status}`, uiLang) }));
    res.redirect(`${adminBase(req)}/events`);
  }),
);

router.post(
  '/:id/delete',
  requirePermission(TENANT_PERMISSIONS.EVENTS_WRITE),
  asyncHandler(async (req, res) => {
    // Scoped users may only delete their own draft events.
    const scope = eventScope(req);
    const event = await eventService.getEvent(req.tenant._id, req.params.id, scope);
    if (!event) return res.status(404).render('errors/404', { title: 'Not found' });
    if (scope && event.status !== EVENT_STATUS.DRAFT) {
      req.flash('error', translate('flash.eventDeleteDenied', req.tenantSettings.defaultLanguage));
      return res.redirect(`${adminBase(req)}/events`);
    }
    await eventService.deleteEvent(req.tenant._id, req.params.id, scope);
    await audit({
      tenantId: req.tenant._id,
      actor: req.user,
      action: AUDIT_ACTIONS.EVENT_DELETED,
      entityType: 'event',
      entityId: event._id,
    });
    req.flash('success', translate('events.deleted', req.tenantSettings.defaultLanguage));
    res.redirect(`${adminBase(req)}/events`);
  }),
);

export default router;
