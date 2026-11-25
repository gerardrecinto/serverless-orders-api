import { createApi } from "./api.ts";
import { awsDeps } from "./aws.ts";
import { createWorker } from "./worker.ts";

// Clients are created once per container and reused across invocations.
const deps = awsDeps(process.env);

export const api = createApi(deps);
export const worker = createWorker(deps);
