export const CENTRAL_CONTRACT_VERSION = 'pnm.central-foundation/v1';

export const CENTRAL_AREAS = Object.freeze([
  Object.freeze({ id: 'painel', label: 'Painel', state: 'informativo' }),
  Object.freeze({ id: 'produtos', label: 'Produtos', state: 'somente-leitura' }),
  Object.freeze({ id: 'novo-produto', label: 'Novo Produto', state: 'indisponivel-nesta-etapa' }),
  Object.freeze({ id: 'saude-links', label: 'Saúde dos Links', state: 'contrato-pronto' }),
  Object.freeze({ id: 'historico', label: 'Histórico', state: 'sem-persistencia-nesta-etapa' }),
]);

export const CENTRAL_CONTRACTS = Object.freeze({
  version: CENTRAL_CONTRACT_VERSION,
  authentication: Object.freeze({
    provider: 'cloudflare-access',
    enforcement: 'external-boundary-plus-worker-jwt-verification',
    localPassword: false,
    workerJwtVerification: true,
    requiredRuntime: Object.freeze([
      'PNM_CENTRAL_ACCESS_AUD',
      'PNM_CENTRAL_ACCESS_ISSUER',
      'PNM_CENTRAL_EXPECTED_HOST',
    ]),
    accessAssertionHeader: 'cf-access-jwt-assertion',
    algorithm: 'RS256',
    jwksPath: '/cdn-cgi/access/certs',
  }),
  catalog: Object.freeze({
    owner: 'data/produtos-index.js',
    ownerRole: 'canonical',
    centralDatabaseOwner: false,
    projection: Object.freeze({
      contract: 'pnm.central-products/v1',
      source: 'data/produtos-index.js',
      generatedModule: 'central/src/generated/products.mjs',
      authoritative: false,
      readOnly: true,
      networkRequired: false,
    }),
    e2: Object.freeze({
      lifecycleTestCommand: 'npm run test:e2-catalog-operations',
      validateCommand: 'npm run validate:e2-catalog',
      validatorModule: 'scripts/validar-catalogo-operacional.mjs',
    }),
  }),
  affiliateIntegrity: Object.freeze({
    contract: 'pnm.affiliate-integrity/v1',
    command: 'npm run audit:affiliate-integrity',
    cli: 'scripts/audit-affiliate-integrity.mjs',
    mode: 'on-demand-future-integration',
  }),
  githubTransaction: Object.freeze({
    mutationEnabled: false,
    targetBranch: 'main',
    requiredStatusCheck: 'validar',
    flow: Object.freeze(['branch', 'commit', 'pull-request', 'ci', 'merge-controlado']),
    automaticMerge: false,
  }),
  d1: Object.freeze({
    bindingPrepared: false,
    authoritativeCatalog: false,
    allowedPurposes: Object.freeze(['historico', 'auditorias', 'eventos-operacionais', 'rastreabilidade']),
  }),
  mutations: Object.freeze({
    products: false,
    github: false,
    batch: false,
    automaticLinkCorrection: false,
    automaticLinkMonitor: false,
  }),
});

export function centralCapabilities() {
  return {
    contract: CENTRAL_CONTRACT_VERSION,
    areas: CENTRAL_AREAS,
    owner: CENTRAL_CONTRACTS.catalog.owner,
    catalogProjection: CENTRAL_CONTRACTS.catalog.projection,
    authentication: CENTRAL_CONTRACTS.authentication.provider,
    githubMutationEnabled: CENTRAL_CONTRACTS.githubTransaction.mutationEnabled,
    productMutationEnabled: CENTRAL_CONTRACTS.mutations.products,
    automaticMergeEnabled: CENTRAL_CONTRACTS.githubTransaction.automaticMerge,
    d1AuthoritativeCatalog: CENTRAL_CONTRACTS.d1.authoritativeCatalog,
    e2: CENTRAL_CONTRACTS.catalog.e2,
    affiliateIntegrity: CENTRAL_CONTRACTS.affiliateIntegrity,
  };
}
