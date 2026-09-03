import { Command } from "commander";
import { registerBlobCreate } from "./create.js";
import { registerBlobList } from "./list.js";
import { registerBlobGet } from "./get.js";
import { registerBlobDelete } from "./delete.js";
import { registerBlobCredentials } from "./credentials.js";

export function registerBlob(program: Command): void {
  const blob = program.command("blob").description("Manage Blob buckets");

  registerBlobCreate(blob);
  registerBlobList(blob);
  registerBlobGet(blob);
  registerBlobDelete(blob);
  registerBlobCredentials(blob);
}
