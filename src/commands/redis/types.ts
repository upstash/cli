export type Database = {
  database_id: string;
  database_name: string;
  password: string;
  endpoint: string;
  port: number;

  region: string;
  consistent: boolean;
};
