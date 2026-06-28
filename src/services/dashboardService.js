import Event from '../models/Event.js';
import Category from '../models/Category.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { EVENT_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import { translationCompleteness } from './eventService.js';

function eventFilter(tenantId, scopeUserId) {
  const filter = { tenantId };
  if (scopeUserId) filter.createdBy = scopeUserId;
  return filter;
}

export async function getDashboard(tenant, settings, scopeUserId = null) {
  const tenantId = tenant._id;
  const base = eventFilter(tenantId, scopeUserId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    upcoming,
    drafts,
    published,
    thisMonth,
    topCategoriesRaw,
    aiUsage,
    editorCount,
    recentEvents,
    allEvents,
  ] = await Promise.all([
    Event.countDocuments({ ...base, status: EVENT_STATUS.PUBLISHED, startAt: { $gte: now } }),
    Event.countDocuments({ ...base, status: EVENT_STATUS.DRAFT }),
    Event.countDocuments({ ...base, status: EVENT_STATUS.PUBLISHED }),
    Event.countDocuments({ ...base, startAt: { $gte: monthStart, $lte: monthEnd } }),
    Event.aggregate([
      { $match: base },
      { $unwind: '$categoryIds' },
      { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    AuditLog.countDocuments({
      tenantId,
      ...(scopeUserId ? { actorId: scopeUserId } : {}),
      action: { $in: [AUDIT_ACTIONS.TRANSLATION_EXECUTED, AUDIT_ACTIONS.MARKETING_GENERATED] },
    }),
    User.countDocuments({ 'tenantMemberships.tenantId': tenantId }),
    Event.find(base).sort({ updatedAt: -1 }).limit(5).populate('createdBy', 'name email').lean(),
    Event.find(base).select('translations').lean(),
  ]);

  // Resolve top category names.
  const catIds = topCategoriesRaw.map((c) => c._id);
  const cats = await Category.find({ _id: { $in: catIds } }).lean();
  const topCategories = topCategoriesRaw.map((c) => ({
    category: cats.find((x) => String(x._id) === String(c._id)),
    count: c.count,
  }));

  // Average translation completeness across all events.
  const supported = settings.supportedLanguages || [];
  let completenessSum = 0;
  for (const ev of allEvents) {
    completenessSum += translationCompleteness(ev, supported);
  }
  const translationCompletion = allEvents.length
    ? Math.round((completenessSum / allEvents.length) * 100)
    : 0;

  // Content completion: events that have a cover image and at least one category.
  const contentComplete = await Event.countDocuments({
    ...base,
    coverMediaId: { $ne: null },
    categoryIds: { $ne: [] },
  });
  const totalEvents = allEvents.length;

  return {
    upcoming,
    drafts,
    published,
    thisMonth,
    topCategories,
    aiUsage,
    editorCount,
    recentEvents,
    translationCompletion,
    contentCompletion: totalEvents ? Math.round((contentComplete / totalEvents) * 100) : 0,
    totalEvents,
  };
}
