export type Cluster = {
  cluster_id: string;
  name: string;
  region: string;
  type: string;
  multizone: boolean;
  tcp_endpoint: string;
  rest_endpoint: string;
  state: string;
  username: string;
  password: string;
  max_retention_size: number;
  max_retention_time: number;
  max_messages_per_second: number;
  creation_time: number;
  max_message_size: number;
  max_partitions: number;
};
