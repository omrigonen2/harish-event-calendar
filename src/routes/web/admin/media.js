import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../../../lib/asyncHandler.js';
import { editorScope } from '../../../middleware/requireRole.js';
import * as mediaService from '../../../services/mediaService.js';
import { audit } from '../../../services/auditService.js';
import { AUDIT_ACTIONS } from '../../../config/constants.js';
import { translate } from '../../../lib/ui-i18n.js';

const router = express.Router({ mergeParams: true });

function lang(req) {
  return req.tenantSettings.defaultLanguage;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    return cb(null, true);
  },
});

function base(req) {
  return `/admin/${req.tenant.slug}`;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const scope = editorScope(req);
    const [assets, folders] = await Promise.all([
      mediaService.listMedia(req.tenant._id, {
        folder: req.query.folder,
        q: req.query.q,
        userId: scope,
      }),
      mediaService.listFolders(req.tenant._id, scope),
    ]);
    res.render('admin/media', {
      title: res.locals.t('media.title'),
      activeNav: 'media',
      assets,
      folders,
      filterFolder: req.query.folder || '',
      q: req.query.q || '',
      scopedToUser: Boolean(scope),
      aspectWarnings: req.session.lastAspectWarnings || [],
    });
    delete req.session.lastAspectWarnings;
  }),
);

router.post(
  '/upload',
  upload.array('files', 12),
  asyncHandler(async (req, res) => {
    const tags = (req.body.tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    let uploaded = 0;
    let duplicates = 0;
    const created = [];
    const aspectWarnings = [];
    for (const file of req.files || []) {
      const { duplicate, asset, aspectWarning } = await mediaService.uploadImage(req.tenant, req.user._id, file, {
        folder: req.body.folder || '',
        tags,
      });
      if (aspectWarning) aspectWarnings.push({ filename: file.originalname, ...aspectWarning });
      if (duplicate) duplicates += 1;
      else {
        uploaded += 1;
        created.push(asset);
        await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.MEDIA_UPLOADED, entityType: 'media', entityId: asset._id });
      }
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      const items = created.map((a) => ({
        id: a._id,
        filename: a.filename,
        url: `${base(req)}/media/${a._id}/raw`,
      }));
      return res.json({ uploaded, duplicates, items, aspectWarnings });
    }
    if (aspectWarnings.length) {
      req.flash('info', translate('flash.mediaAspectWarning', lang(req), {
        count: aspectWarnings.length,
        size: `${aspectWarnings[0].width}×${aspectWarnings[0].height}`,
        target: `${aspectWarnings[0].targetWidth}×${aspectWarnings[0].targetHeight}`,
      }));
      req.session.lastAspectWarnings = aspectWarnings;
    }
    req.flash('success', translate('flash.mediaUploaded', lang(req), {
      count: uploaded,
      duplicates: duplicates ? translate('flash.mediaDuplicates', lang(req), { count: duplicates }) : '',
    }));
    return res.redirect(`${base(req)}/media`);
  }),
);

router.get(
  '/picker',
  asyncHandler(async (req, res) => {
    const scope = editorScope(req);
    const assets = await mediaService.listMedia(req.tenant._id, { q: req.query.q, userId: scope });
    const b = base(req);
    const items = assets.slice(0, 60).map((a) => ({
      id: a._id,
      filename: a.filename,
      url: `${b}/media/${a._id}/raw`,
    }));
    res.json({ items });
  }),
);

router.get(
  '/:id/raw',
  asyncHandler(async (req, res) => {
    const scope = editorScope(req);
    const url = await mediaService.urlFor(req.tenant._id, req.params.id, scope);
    if (!url) return res.status(404).end();
    res.redirect(url);
  }),
);

router.post(
  '/:id/meta',
  asyncHandler(async (req, res) => {
    const scope = editorScope(req);
    const tags = (req.body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const updated = await mediaService.updateMeta(
      req.tenant._id,
      req.params.id,
      { folder: req.body.folder || '', tags },
      scope,
    );
    if (!updated) {
      return res.status(404).render('errors/404', { title: 'Not found' });
    }
    req.flash('success', translate('flash.mediaUpdated', lang(req)));
    res.redirect(`${base(req)}/media`);
  }),
);

router.post(
  '/:id/delete',
  asyncHandler(async (req, res) => {
    const scope = editorScope(req);
    const deleted = await mediaService.deleteMedia(req.tenant._id, req.params.id, scope);
    if (!deleted) {
      return res.status(404).render('errors/404', { title: 'Not found' });
    }
    await audit({ tenantId: req.tenant._id, actor: req.user, action: AUDIT_ACTIONS.MEDIA_DELETED, entityType: 'media', entityId: req.params.id });
    req.flash('success', translate('flash.mediaDeleted', lang(req)));
    res.redirect(`${base(req)}/media`);
  }),
);

export default router;
