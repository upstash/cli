import { Command } from "commander";
import { registerBlobCreate } from "./create.js";
import { registerBlobList } from "./list.js";
import { registerBlobGet } from "./get.js";
import { registerBlobDelete } from "./delete.js";
import { registerBlobCredentials } from "./credentials.js";
import { registerBlobUpload } from "./upload.js";
import { registerBlobLs } from "./ls.js";
import { registerBlobCp, registerBlobMv } from "./cp.js";
import { registerBlobRm } from "./rm.js";
import { registerBlobSync } from "./sync.js";
import { registerBlobPresign } from "./presign.js";
import { registerBlobMb, registerBlobRb } from "./mb.js";

export function registerBlob(program: Command): void {
  const blob = program.command("blob").description("Manage Blob buckets and objects");

  registerBlobCreate(blob);
  registerBlobList(blob);
  registerBlobGet(blob);
  registerBlobDelete(blob);
  registerBlobCredentials(blob);
  registerBlobUpload(blob);
  registerBlobLs(blob);
  registerBlobCp(blob);
  registerBlobMv(blob);
  registerBlobRm(blob);
  registerBlobSync(blob);
  registerBlobPresign(blob);
  registerBlobMb(blob);
  registerBlobRb(blob);
}
