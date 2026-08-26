const MAX_LISTED_OBJECTS = 5000;

async function listAllObjects(bucket) {
  const objects = [];
  let cursor;

  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    objects.push(...(page.objects || []));
    if (objects.length > MAX_LISTED_OBJECTS) {
      throw new Error("Media integrity scan exceeded the safe object limit.");
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects;
}

export async function inspectMediaIntegrity(db, bucket) {
  const [mediaResult, invalidPrimaryResult, objects] = await Promise.all([
    db.prepare(`
      SELECT m.id, m.object_key AS objectKey, m.status, m.byte_size AS byteSize,
             a.id AS linkedArtworkId
      FROM media_assets m
      LEFT JOIN artworks a ON a.primary_media_id = m.id
      ORDER BY m.object_key
    `).all(),
    db.prepare(`
      SELECT a.id AS artworkId, a.primary_media_id AS mediaId,
             m.status AS mediaStatus
      FROM artworks a
      LEFT JOIN media_assets m ON m.id = a.primary_media_id
      WHERE a.primary_media_id IS NOT NULL
        AND (m.id IS NULL OR m.status <> 'active')
      ORDER BY a.id
    `).all(),
    listAllObjects(bucket),
  ]);

  const media = mediaResult.results || [];
  const invalidPrimaryReferences = invalidPrimaryResult.results || [];
  const objectKeys = new Set(objects.map((object) => object.key));
  const databaseKeys = new Set(media.map((item) => item.objectKey));
  const missingObjects = media
    .filter((item) => !objectKeys.has(item.objectKey))
    .map((item) => ({ mediaId: item.id, objectKey: item.objectKey, status: item.status }));
  const orphanObjects = objects
    .filter((object) => !databaseKeys.has(object.key))
    .map((object) => ({ objectKey: object.key, size: Number(object.size || 0) }));
  const unlinkedActiveMedia = media
    .filter((item) => item.status === 'active' && !item.linkedArtworkId)
    .map((item) => ({ mediaId: item.id, objectKey: item.objectKey }));
  const databaseBytes = media.reduce((total, item) => total + Number(item.byteSize || 0), 0);
  const bucketBytes = objects.reduce((total, object) => total + Number(object.size || 0), 0);

  return {
    healthy: missingObjects.length === 0
      && orphanObjects.length === 0
      && unlinkedActiveMedia.length === 0
      && invalidPrimaryReferences.length === 0,
    checkedAt: new Date().toISOString(),
    totals: {
      databaseAssets: media.length,
      databaseBytes,
      bucketObjects: objects.length,
      bucketBytes,
    },
    issues: {
      missingObjects,
      orphanObjects,
      unlinkedActiveMedia,
      invalidPrimaryReferences,
    },
  };
}
