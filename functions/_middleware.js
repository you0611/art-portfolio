import { handlePreviewGate } from "./_lib/preview-gate.js";

export async function onRequest(context) {
  return handlePreviewGate(context);
}
