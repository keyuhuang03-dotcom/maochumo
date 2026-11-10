import type { UploadIntent, UploadResult } from "../../contracts/index";
import { request } from "./request";
/** Boundary: returns 503 until a storage adapter exists. Do not return fake image references. */
export async function prepareUpload(
  intent: UploadIntent,
): Promise<UploadResult> {
  return request("/api/v1/uploads", "POST", intent);
}
