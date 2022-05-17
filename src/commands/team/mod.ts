import { Command } from "../../util/command.ts";
import { createCmd } from "./create.ts";
import { listCmd } from "./list.ts";
import { deleteCmd } from "./delete.ts";
import { addMemberCmd } from "./add_member.ts";
import { removeMemberCmd } from "./remove_member.ts";
import { listMembersCmd } from "./list_members.ts";

export const teamCmd = new Command()
  .description("Manage your teams and their members")
  .globalOption("--json=[boolean:boolean]", "Return raw json response")
  .command("create", createCmd)
  .command("list", listCmd)
  .command("delete", deleteCmd)
  .command("add-member", addMemberCmd)
  .command("remove-member", removeMemberCmd)
  .command("list-members", listMembersCmd);

teamCmd.reset().action(() => {
  teamCmd.showHelp();
});
