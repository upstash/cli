import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { parseAuth } from "../../util/auth.ts";
import { http } from "../../util/http.ts";
enum Role {
  admin = "admin",
  dev = "dev",
  finance = "finance",
}
export const addMemberCmd = new Command()
  .name("add-member")
  .description("Add a new member to a team")
  .type("role", new cliffy.EnumType(Role))
  .option("--id <string:string>", "The id of your team", { required: true })
  .option(
    "--member-email <string:string>",
    "The email of a user you want to add.",
    {
      required: true,
    },
  )
  .option("--role <string:role>", "The role for the new user", {
    required: true,
  })
  .example(
    "Add new developer",
    `upstash team add-member --id=f860e7e2-27b8-4166-90d5-ea41e90b4809 --member-email=bob@acme.com --role=${Role.dev}`,
  )
  .action(async (options): Promise<void> => {
    const authorization = await parseAuth(options);

    if (!options.id) {
      if (options.ci) {
        throw new cliffy.ValidationError("id");
      }
      const teams = await http.request<
        { team_name: string; team_id: string }[]
      >({
        method: "GET",
        authorization,
        path: ["v2", "teams"],
      });
      options.id = await cliffy.Select.prompt({
        message: "Select a team",
        options: teams.map(({ team_name, team_id }) => ({
          name: team_name,
          value: team_id,
        })),
      });
    }
    if (!options.memberEmail) {
      if (options.ci) {
        throw new cliffy.ValidationError("memberEmail");
      }
      options.memberEmail = await cliffy.Input.prompt("Enter the user's email");
    }
    if (!options.role) {
      if (options.ci) {
        throw new cliffy.ValidationError("role");
      }
      options.role = (await cliffy.Select.prompt({
        message: "Select a role",
        options: Object.entries(Role).map(([name, value]) => ({
          name,
          value,
        })),
      })) as Role;
    }

    const res = await http.request<{
      team_name: string;
      member_email: string;
      member_role: Role;
    }>({
      method: "POST",
      authorization,
      path: ["v2", "teams", "member"],
      body: {
        team_id: options.id,
        member_email: options.memberEmail,
        member_role: options.role,
      },
    });
    if (options.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }
    console.log(
      cliffy.colors.brightGreen(
        `${res.member_email} has been invited to join ${res.team_name} as ${res.member_role}`,
      ),
    );
  });
