// Documentation declarations only. Runtime implementation is CommonJS JavaScript.
export interface SecretRef { resource: string; key: string }
export interface Endpoint { host: string; port: number; transport: "tcp" }
export interface InfrastructureSpec {
  contract_version: "1";
  instance: { id: string; domain?: string };
  dns: { mode: "none" | "local" | "localhost" };
  http: { enabled: boolean; https: boolean; accepted_hosts?: string[] };
  tls?: { provider: "provided"; certificate_ref: SecretRef; private_key_ref: SecretRef };
}
export interface KernelInfrastructureRequirements {
  contract_version: "1";
  http: {
    service_endpoint: Endpoint; page_endpoint: Endpoint; websocket_endpoint: Endpoint;
    public_assets: { id: string; url_prefix: string; root: string }[];
    delegated_artifact_root: string; internal_artifact_prefix: string;
    max_binary_chunk_bytes: number; readiness_path: string; bootstrap_paths: string[];
  };
}
export interface DockerNginxInput {
  kind: "docker-nginx"; project: string; network: string; image: string;
  listen_port: number; health_port: number;
  bindings: { host_address: string; host_port: number }[];
  artifact_view: { source: string; target: string; kernel_target: string };
  public_views: { id: string; source: string; target: string }[];
  tls_views?: { ref: SecretRef; source: string; target: string }[];
  tmpfs_bytes: number;
  timeouts: { client_body_seconds: number; upstream_seconds: number; websocket_seconds: number; send_seconds: number };
}
export interface Diagnostic { code: string; field: string; severity: "error" | "info" }
export interface Observation { ports?: { address: string; port: number; protocol: "tcp" | "udp" }[] }
export interface InfrastructurePlan {
  contract_version: "1"; applicable: boolean; revision?: string; effective_domain?: string;
  diagnostics: Diagnostic[]; conflicts: Diagnostic[];
  artifacts: { path: string; digest: string; content: string; mode: number }[];
  resources: object[]; compatibility: { code: string; validation?: string; satisfied?: boolean }[];
  prerequisites: { owner: string; code: string }[];
  inputs?: { spec: InfrastructureSpec; requirements: KernelInfrastructureRequirements; adapter_input: DockerNginxInput };
}
export interface Deployment {
  id: string; desired_revision: string; container_id?: string;
  /** Required by docker-nginx; exact applicable plan, not caller-provided URLs. */
  plan?: InfrastructurePlan;
}
export interface GatewayObservation {
  running?: boolean; health?: string; observed_revision?: string; active_revision?: string; http_ready?: boolean;
  diagnostic_codes?: string[];
  loaded_configuration?: { status: "unknown" | "unverified" | "verified"; revision?: string; evidence?: "activation-attestation" | "process-attestation" };
  protected_delivery_verified?: boolean;
}
export interface InfrastructureState {
  contract_version: "1"; deployment: string; desired_revision: string; observed_revision?: string;
  /** Compatibility alias for observed_revision; never evidence of loaded config. */
  active_revision?: string;
  loaded_configuration: { status: "unknown" | "unverified" | "verified"; revision?: string; evidence?: string };
  verification: { functional: boolean; protected_delivery: "verified" | "unverified" };
  capabilities: { name: string; required: boolean; readiness: "ready" | "degraded" | "failed"; diagnostic_codes: string[] }[];
  dependencies: { name: string; readiness: "ready" | "unknown" }[];
  metadata: { adapter: string; runtime_id?: string };
}
export function validateSpec(spec: unknown, requirements: unknown): {
  valid: boolean; diagnostics: Diagnostic[]; effective_domain?: string;
  spec?: InfrastructureSpec; requirements?: KernelInfrastructureRequirements;
};
export function planInfrastructure(spec: unknown, requirements: unknown, adapter_input: unknown, observation?: Observation): InfrastructurePlan;
export function renderPlan(plan: InfrastructurePlan, output_directory: string): { revision: string; files: string[]; activated: false };
export function inspectInfrastructure(deployment: Deployment, adapter: { kind?: string; observe(deployment: Deployment): Promise<GatewayObservation> }): Promise<InfrastructureState>;
export function diagnoseInfrastructure(state: InfrastructureState, requirements: KernelInfrastructureRequirements): { ready: boolean; diagnostics: { code: string; capability?: string }[] };
