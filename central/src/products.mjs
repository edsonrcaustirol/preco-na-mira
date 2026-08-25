export const CENTRAL_PRODUCTS_CONTRACT = 'pnm.central-products/v1';
export const CENTRAL_PRODUCTS_SOURCE = 'data/produtos-index.js';

export const CENTRAL_PRODUCT_FIELDS = Object.freeze([
  'id',
  'nome',
  'marca',
  'categoria',
  'categoriaId',
  'tipoProduto',
  'imagem',
  'imagemAlt',
  'linkAfiliado',
  'loja',
  'resumo',
  'chamada',
  'chips',
  'oferta',
  'destaque',
  'selo',
  'fonteTecnica',
  'fonteNome',
  'imagemTipo',
]);

export function selectCentralProductFields(product) {
  const selected = {};
  for (const field of CENTRAL_PRODUCT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(product, field)) selected[field] = product[field];
  }
  return selected;
}

export function normalizeProductText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function searchCentralProducts(products, query) {
  const needle = normalizeProductText(query);
  if (!needle) return [...products];
  return products.filter(product => [
    product.nome,
    product.id,
    product.marca,
    product.categoria,
    product.linkAfiliado,
  ].some(value => normalizeProductText(value).includes(needle)));
}

function matchesTextFilter(actual, expected) {
  const normalizedExpected = normalizeProductText(expected);
  return !normalizedExpected || normalizeProductText(actual) === normalizedExpected;
}

function matchesBooleanFilter(actual, expected) {
  if (expected === '' || expected === undefined || expected === null || expected === 'all') return true;
  if (expected === true || expected === 'true') return actual === true;
  if (expected === false || expected === 'false') return actual !== true;
  return true;
}

export function filterCentralProducts(products, filters = {}) {
  return products.filter(product => (
    matchesTextFilter(product.categoria, filters.categoria) &&
    matchesTextFilter(product.marca, filters.marca) &&
    matchesBooleanFilter(product.oferta, filters.oferta) &&
    matchesBooleanFilter(product.destaque, filters.destaque)
  ));
}

function compareProductNames(left, right) {
  const a = normalizeProductText(left?.nome);
  const b = normalizeProductText(right?.nome);
  if (a < b) return -1;
  if (a > b) return 1;
  const aId = String(left?.id ?? '');
  const bId = String(right?.id ?? '');
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

export function sortCentralProducts(products, order = 'name-asc') {
  const sorted = [...products].sort(compareProductNames);
  if (order === 'name-desc') sorted.reverse();
  return sorted;
}

export function queryCentralProducts(projection, options = {}) {
  const searched = searchCentralProducts(projection?.products || [], options.query || '');
  const filtered = filterCentralProducts(searched, options);
  return sortCentralProducts(filtered, options.order || 'name-asc');
}
