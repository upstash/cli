import { Command } from "commander";
import { registerTeamList } from "./list.js";
import { registerTeamCreate } from "./create.js";
import { registerTeamDelete } from "./delete.js";
import { registerTeamMembers } from "./members.js";
import { registerTeamAddMember } from "./add-member.js";
import { registerTeamRemoveMember } from "./remove-member.js";

export function registerTeam(program: Command): void {
  const team = program.command("team").description("Manage teams");

  registerTeamList(team);
  registerTeamCreate(team);
  registerTeamDelete(team);
  registerTeamMembers(team);
  registerTeamAddMember(team);
  registerTeamRemoveMember(team);
}
