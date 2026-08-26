import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from '../functions/api/admin/media-integrity.js';

function database(media = [], invalidReferences = []) {
  return {
    prepare(sql) {
      return {
        async all() {
          return { results: sql.includes('WHERE a.primary_media_id IS NOT NULL') ? invalidReferences : media };
        },
      };
    },
  };
}

function bucket(objects = []) {
  return {
    async list() { return { objects, truncated: false }; },
  };
}

function context({ method = 'GET', media = [], invalidReferences = [], objects = [], includeBucket = true } = {}) {
  return {
    request: new Request('https://preview.example.test/api/admin/media-integrity', { method }),
    env: {
      DB: database(media, invalidReferences),
      ...(includeBucket ? { MEDIA: bucket(objects) } : {}),
    },
  };
}

test('media integrity reports a healthy exact match', async () => {
  const response = await onRequest(context({
    media: [{ id: 'media-1', objectKey: 'artworks/a/media-1.jpg', status: 'active', byteSize: 100, linkedArtworkId: 'a' }],
    objects: [{ key: 'artworks/a/media-1.jpg', size: 100 }],
  }));
  const report = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(report.healthy, true);
  assert.deepEqual(report.totals, { databaseAssets: 1, databaseBytes: 100, bucketObjects: 1, bucketBytes: 100 });
  assert.deepEqual(report.issues, {
    missingObjects: [],
    orphanObjects: [],
    unlinkedActiveMedia: [],
    invalidPrimaryReferences: [],
  });
});

test('media integrity identifies orphaned, missing, and invalid references without changing them', async () => {
  const response = await onRequest(context({
    media: [
      { id: 'media-missing', objectKey: 'artworks/a/missing.jpg', status: 'active', byteSize: 120, linkedArtworkId: null },
    ],
    invalidReferences: [{ artworkId: 'a', mediaId: 'media-missing', mediaStatus: null }],
    objects: [{ key: 'artworks/orphan/test.jpg', size: 55 }],
  }));
  const report = await response.json();

  assert.equal(report.healthy, false);
  assert.deepEqual(report.issues.missingObjects, [
    { mediaId: 'media-missing', objectKey: 'artworks/a/missing.jpg', status: 'active' },
  ]);
  assert.deepEqual(report.issues.orphanObjects, [{ objectKey: 'artworks/orphan/test.jpg', size: 55 }]);
  assert.deepEqual(report.issues.unlinkedActiveMedia, [
    { mediaId: 'media-missing', objectKey: 'artworks/a/missing.jpg' },
  ]);
  assert.deepEqual(report.issues.invalidPrimaryReferences, [
    { artworkId: 'a', mediaId: 'media-missing', mediaStatus: null },
  ]);
});

test('media integrity remains read-only and fails closed when storage is unavailable', async () => {
  const unavailable = await onRequest(context({ includeBucket: false }));
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'MEDIA_STORAGE_NOT_CONFIGURED');

  const wrongMethod = await onRequest(context({ method: 'POST' }));
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET');
});
