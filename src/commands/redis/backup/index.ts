import { Command } from "commander";
import { registerBackupList } from "./list.js";
import { registerBackupCreate } from "./create.js";
import { registerBackupDelete } from "./delete.js";
import { registerBackupRestore } from "./restore.js";
import { registerEnableDaily } from "./enable-daily.js";
import { registerDisableDaily } from "./disable-daily.js";

export function registerBackup(redis: Command): void {
  const backup = redis.command("backup").description("Manage Redis database backups");

  registerBackupList(backup);
  registerBackupCreate(backup);
  registerBackupDelete(backup);
  registerBackupRestore(backup);
  registerEnableDaily(backup);
  registerDisableDaily(backup);
}
