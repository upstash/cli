export type Topic = {
  topic_id: string;
  topic_name: string;
  cluster_id: string;
  region: string;
  creation_time: number;
  state: string;
  partitions: number;
  multizone: boolean;
  tcp_endpoint: string;
  rest_endpoint: string;
  username: string;
  password: string;
  cleanup_policy: string;
  retention_size: number;
  retention_time: number;
  max_message_size: number;
};

export const retentionTime = {
  "1hour": 1000 * 60 * 60,
  "1day": 1000 * 60 * 60 * 24,
  "1week": 1000 * 60 * 60 * 24 * 7,
  "1month": 1000 * 60 * 60 * 24 * 7 * 30,
  "1year": 1000 * 60 * 60 * 24 * 7 * 365,
};

export const retentionSize = {
  "1mb": 1024 ** 2,
  "256mb": 1024 ** 2 * 256,
  "1gb": 1024 ** 3,
  "10gb": 1024 ** 3 * 10,
  "100gb": 1024 ** 3 * 100,
  "1tb": 1024 ** 4,
};

export const maxMessageSize = {
  "100kb": 1024 * 100,
  "500kb": 1024 * 500,
  "1mb": 1024 ** 2,
  "10mb": 1024 ** 2 * 10,
  "100mb": 1024 ** 2 * 100,
};

export const cleanupPolicy = {
  delete: "delete",
  compact: "compact",
};
