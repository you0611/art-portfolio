import { adminJson, adminMethodNotAllowed, adminServiceUnavailable } from '../../_lib/http.js';
import { inspectMediaIntegrity } from '../../_lib/media-integrity.js';

export async function onRequest(context) {
  if (context.request.method !== 'GET') return adminMethodNotAllowed(['GET']);
  if (!context.env.MEDIA) {
    return adminJson(
      { error: { code: 'MEDIA_STORAGE_NOT_CONFIGURED', message: 'Media storage is unavailable.' } },
      { status: 503 },
    );
  }

  try {
    return adminJson(await inspectMediaIntegrity(context.env.DB, context.env.MEDIA));
  } catch (error) {
    console.error('media_integrity_check_failed', { message: error?.message || 'unknown' });
    return adminServiceUnavailable();
  }
}
