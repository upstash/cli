import { Command, InvalidArgumentError } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { VECTOR_REGIONS, VECTOR_SIMILARITY_FUNCTIONS, VECTOR_INDEX_TYPES, VECTOR_EMBEDDING_MODELS, VECTOR_SPARSE_MODELS, VECTOR_PLANS } from "../../types.js";
import type { VectorIndex } from "../../types.js";

function parseNonNegativeInt(name: string) {
  return (v: string): number => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      throw new InvalidArgumentError(`--${name} must be a non-negative integer; got "${v}"`);
    }
    return n;
  };
}

export function registerVectorCreate(vector: Command): void {
  vector
    .command("create")
    .description("Create a new vector index")
    .requiredOption("--name <name>", "Index name")
    .requiredOption("--region <region>", `Region. Available: ${VECTOR_REGIONS.join(", ")}`)
    .requiredOption("--similarity-function <fn>", `Similarity function. Available: ${VECTOR_SIMILARITY_FUNCTIONS.join(", ")}`)
    .requiredOption("--dimension-count <n>", "Number of dimensions per vector", parseNonNegativeInt("dimension-count"))
    .option("--type <type>", `Plan type. Available: ${VECTOR_PLANS.join(", ")}`)
    .option("--embedding-model <model>", `Embedding model. Available: ${VECTOR_EMBEDDING_MODELS.join(", ")}`)
    .option("--index-type <type>", `Index type. Available: ${VECTOR_INDEX_TYPES.join(", ")}`)
    .option("--sparse-embedding-model <model>", `Sparse embedding model. Available: ${VECTOR_SPARSE_MODELS.join(", ")}`)
    .action(async (flags: { name: string; region: string; similarityFunction: string; dimensionCount: number; type?: string; embeddingModel?: string; indexType?: string; sparseEmbeddingModel?: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<VectorIndex>(auth, "POST", "/v2/vector/index", {
        name: flags.name,
        region: flags.region,
        similarity_function: flags.similarityFunction,
        dimension_count: flags.dimensionCount,
        type: flags.type,
        embedding_model: flags.embeddingModel,
        index_type: flags.indexType,
        sparse_embedding_model: flags.sparseEmbeddingModel,
      });
      printJSON(idx);
    });
}
