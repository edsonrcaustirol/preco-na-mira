#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ORIGIN='https://preconamira.com.br';
const PAGE_SIZE=24;
const DATA=path.join(ROOT,'data','produtos-mobile.js');
const TEMPLATE=path.join(ROOT,'ofertas.html');

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function readProducts(){
  const source=fs.readFileSync(DATA,'utf8');
  const start=source.indexOf('['),end=source.lastIndexOf(']');
  if(start<0||end<=start)throw new Error('PRODUTOS inválido em data/produtos-mobile.js.');
  return JSON.parse(source.slice(start,end+1));
}
function between(content,startMarker,endMarker,replacement){
  const start=content.indexOf(startMarker),end=content.indexOf(endMarker);
  if(start<0||end<start)throw new Error(`Marcadores ausentes: ${startMarker} / ${endMarker}`);
  return `${content.slice(0,start+startMarker.length)}${replacement}${content.slice(end)}`;
}
function productUrl(product){return `produto-${encodeURIComponent(product.id)}`;}
function imageAttrs(product,index){
  const src=product.imagem||product.imagemFallback||'assets/product-placeholder.svg';
  const fallback=product.imagemFallback||'assets/product-placeholder.svg';
  const loading=index===0?'eager':'lazy';
  const priority=index===0?' fetchpriority="high"':'';
  return `src="${esc(src)}" data-fallback-src="${esc(fallback)}" width="600" height="600" loading="${loading}" decoding="async"${priority} alt="${esc(product.imagemAlt||product.nome)}"`;
}
function safeLabel(product){
  const candidates=[product.faixa,product.selo].filter(Boolean);
  const allowed=/custo|benef[ií]cio|premium|intermedi|entrada|destaque|escolha|selecion|recomend/i;
  return String(candidates.find(value=>allowed.test(String(value)))||'DESTAQUE');
}
function card(product,index){
  return `<article class="pnm-offer-card" data-pnm-product-id="${esc(product.id)}"><div class="pnm-offer-image"><img ${imageAttrs(product,index)}><span>${esc(safeLabel(product))}</span></div><div class="pnm-offer-copy"><small>${esc(product.marca||product.categoria||'Produto')}</small><h3>${esc(product.nome)}</h3><p>${esc(product.chamada||product.resumo||'Veja a análise e confirme se esta opção combina com o que você procura.')}</p><div><a href="${productUrl(product)}">ANALISAR</a><a class="hot" href="${esc(product.linkAfiliado||'#')}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(product.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></article>`;
}
function pagePath(page){return page<=1?'ofertas':`ofertas-pagina-${page}`;}
function pageUrl(page){return `${ORIGIN}/${pagePath(page)}`;}
function pagination(page,totalPages){
  if(totalPages<=1)return '';
  const prev=page>1?`<a rel="prev" href="${pagePath(page-1)}">← ANTERIOR</a>`:'<span aria-hidden="true"></span>';
  const next=page<totalPages?`<a rel="next" href="${pagePath(page+1)}">PRÓXIMA →</a>`:'<span aria-hidden="true"></span>';
  const nearby=[];
  for(let current=Math.max(1,page-2);current<=Math.min(totalPages,page+2);current+=1){
    nearby.push(current===page?`<strong aria-current="page">${current}</strong>`:`<a href="${pagePath(current)}" aria-label="Ofertas — página ${current}">${current}</a>`);
  }
  return `<nav class="pnm-seo-pagination" aria-label="Paginação de Ofertas">${prev}<span class="pnm-seo-pages">${nearby.join('')}</span><span class="pnm-seo-page-status">Página ${page} de ${totalPages}</span>${next}</nav>`;
}
function itemList(items,page){
  const schema={'@context':'https://schema.org','@type':'ItemList',name:`Ofertas e destaques selecionados — página ${page}`,itemListElement:items.map((product,index)=>({'@type':'ListItem',position:(page-1)*PAGE_SIZE+index+1,url:`${ORIGIN}/${productUrl(product)}`,name:product.nome}))};
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
function headSeo(items,page,totalPages){
  const tags=[];
  if(page>1)tags.push(`<link rel="prev" href="${pageUrl(page-1)}">`);
  if(page<totalPages)tags.push(`<link rel="next" href="${pageUrl(page+1)}">`);
  tags.push(itemList(items,page));
  return `\n${tags.join('\n')}\n`;
}
function updateMeta(html,page){
  const canonical=pageUrl(page);
  const title=page===1?'Ofertas e destaques selecionados — Preço na Mira':`Ofertas e destaques selecionados — Preço na Mira — Página ${page}`;
  html=html.replace(/<title>[^<]*<\/title>/i,`<title>${esc(title)}</title>`);
  html=html.replace(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i,`<link rel="canonical" href="${canonical}">`);
  html=html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:url"|'og:url'))[^>]*>/i,`<meta property="og:url" content="${canonical}">`);
  html=html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:title"|'og:title'))[^>]*>/i,`<meta property="og:title" content="${esc(title)}">`);
  html=html.replace(/<meta\b(?=[^>]*\bname=(?:"twitter:title"|'twitter:title'))[^>]*>/i,`<meta name="twitter:title" content="${esc(title)}">`);
  return html;
}

const products=readProducts();
const curated=products
  .filter(product=>product?.linkAfiliado&&product.destaque===true)
  .sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
if(curated.length<20)throw new Error(`Curadoria insuficiente: apenas ${curated.length} produtos com destaque=true.`);

let base=fs.readFileSync(TEMPLATE,'utf8');
for(const old of fs.readdirSync(ROOT).filter(name=>/^ofertas-pagina-\d+\.html$/.test(name)))fs.unlinkSync(path.join(ROOT,old));
const totalPages=Math.ceil(curated.length/PAGE_SIZE);
for(let page=1;page<=totalPages;page+=1){
  const items=curated.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  let html=updateMeta(base,page);
  html=between(html,'<!-- PNM:SEO:HEAD:START -->','<!-- PNM:SEO:HEAD:END -->',headSeo(items,page,totalPages));
  html=between(html,'<!-- PNM:SEO:OFERTAS:START -->','<!-- PNM:SEO:OFERTAS:END -->',`\n${items.map(card).join('\n')}\n`);
  html=between(html,'<!-- PNM:SEO:OFERTAS:PAGINATION:START -->','<!-- PNM:SEO:OFERTAS:PAGINATION:END -->',`\n${pagination(page,totalPages)}\n`);
  html=html.replace(/data-pnm-static-page="\d+"/g,`data-pnm-static-page="${page}"`);
  fs.writeFileSync(page===1?TEMPLATE:path.join(ROOT,`ofertas-pagina-${page}.html`),html);
}

const first=fs.readFileSync(TEMPLATE,'utf8');
const firstCards=(first.match(/data-pnm-product-id=/g)||[]).length;
if(firstCards!==Math.min(PAGE_SIZE,curated.length))throw new Error(`Ofertas prerenderizadas inválidas: ${firstCards}.`);
console.log(JSON.stringify({curatedOffers:curated.length,offerPages:totalPages,firstPageCards:firstCards,criterion:'destaque=true'},null,2));
