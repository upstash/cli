export const REGIONS = [
  // AWS
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "sa-east-1",
  "ap-south-1",
  "ap-northeast-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "af-south-1",
  // GCP
  "us-central1",
  "us-east4",
  "europe-west1",
  "asia-northeast1",
] as const;

export type Region = (typeof REGIONS)[number];

export interface Database {
  database_id: string;
  database_name: string;
  password?: string;
  endpoint?: string;
  port?: number;
  creation_time?: number;
  state?: string;
  tls?: boolean;
  type?: string;
  budget?: number;
  primary_region?: string;
  read_regions?: string[];
  eviction?: boolean;
  auto_upgrade?: boolean;
  consistent?: boolean;
  daily_backup_enabled?: boolean;
  region?: string;
  rest_token?: string;
  read_only_rest_token?: string;
  db_max_clients?: number;
  db_memory_threshold?: number;
  db_disk_threshold?: number;
  db_max_entry_size?: number;
  db_max_request_size?: number;
}

export interface Backup {
  backup_id: string;
  backup_name: string;
  creation_time: number;
  database_id?: string;
}

export interface Team {
  team_id: string;
  team_name: string;
  copy_cc?: boolean;
}

export interface TeamMember {
  team_id: string;
  team_name: string;
  member_email: string;
  member_role: "owner" | "admin" | "dev" | "finance";
  copy_cc?: boolean;
}

export const TEAM_MEMBER_ROLES = ["admin", "dev", "finance"] as const;
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];

// ── Vector ────────────────────────────────────────────────────────────────────

export const VECTOR_REGIONS = ["eu-west-1", "us-east-1", "us-central1"] as const;
export type VectorRegion = (typeof VECTOR_REGIONS)[number];

export const VECTOR_SIMILARITY_FUNCTIONS = ["COSINE", "EUCLIDEAN", "DOT_PRODUCT"] as const;
export const VECTOR_INDEX_TYPES = ["DENSE", "SPARSE", "HYBRID"] as const;
export const VECTOR_EMBEDDING_MODELS = [
  "BGE_SMALL_EN_V1_5",
  "BGE_BASE_EN_V1_5",
  "BGE_LARGE_EN_V1_5",
  "BGE_M3",
] as const;
export const VECTOR_SPARSE_MODELS = ["BM25", "BGE_M3"] as const;
export const VECTOR_PLANS = ["free", "payg", "fixed"] as const;

export interface VectorIndex {
  id: string;
  name: string;
  region: string;
  similarity_function: string;
  dimension_count: number;
  embedding_model?: string;
  sparse_embedding_model?: string;
  index_type?: string;
  endpoint: string;
  token: string;
  read_only_token: string;
  type: string;
  creation_time?: number;
  customer_id?: string;
  max_vector_count?: number;
  max_daily_queries?: number;
  max_daily_updates?: number;
  max_writes_per_second?: number;
  max_query_per_second?: number;
  reserved_price?: number;
}

// ── Search ────────────────────────────────────────────────────────────────────

export const SEARCH_REGIONS = ["eu-west-1", "us-central1"] as const;
export type SearchRegion = (typeof SEARCH_REGIONS)[number];

export const SEARCH_PLANS = ["free", "payg", "fixed"] as const;

export interface SearchIndex {
  id: string;
  name: string;
  region: string;
  type: string;
  endpoint: string;
  token: string;
  read_only_token: string;
  creation_time?: number;
  customer_id?: string;
  max_vector_count?: number;
  max_daily_queries?: number;
  max_daily_updates?: number;
  max_writes_per_second?: number;
  max_query_per_second?: number;
  input_enrichment_enabled?: boolean;
}

// ── QStash ────────────────────────────────────────────────────────────────────

export const QSTASH_PLANS = [
  "paid",
  "qstash_fixed_1m",
  "qstash_fixed_10m",
  "qstash_fixed_100m",
] as const;

export const STATS_PERIODS = ["1h", "3h", "12h", "1d", "3d", "7d", "30d"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

export interface QStashUser {
  id: string;
  customer_id: string;
  token: string;
  password?: string;
  active: boolean;
  state: string;
  type: string;
  region: string;
  reserved_type?: string;
  reserved_price?: number;
  budget?: number;
  prod_pack_enabled?: boolean;
  max_requests_per_day?: number;
  max_requests_per_second?: number;
  max_topics?: number;
  max_schedules?: number;
  max_queues?: number;
  timeout?: number;
  creation_time?: number;
}
