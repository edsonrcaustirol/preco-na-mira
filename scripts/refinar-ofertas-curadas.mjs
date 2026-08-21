#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const ORIGIN='https://preconamira.com.br';
const CURATION_TARGET=30;
const PAGE_SIZE=30;
const DATA=path.join(ROOT,'data','produtos-mobile.js');
const TEMPLATE=path.join(ROOT,'ofertas.html');
const BUCKET_QUOTAS={casa:8,tecnologia:8,gamer:7,cozinha:7};

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

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
function bucket(product){
  const text=norm([product.tipoProduto,product.categoriaId,product.categoria,product.subtipo,product.subtipoCozinha,product.subtipoCasa,product.subtipoObra,product.subtipoInstalacao,product.subtipoAcabamento].join(' '));
  if(/gamer|pc|gpu|processador|monitor|mouse|teclado|memoria|placa/.test(text))return'gamer';
  if(/cozinha|airfryer|air fryer|cafeteira|geladeira|fogao|forno|panela|lava-loucas/.test(text))return'cozinha';
  if(/casa|obra|instal|acabamento|banheiro|hidraul|lavanderia|limpeza|aspirador/.test(text))return'casa';
  return'tecnologia';
}
function criterion(product){
  const explicit=norm([product.faixa,product.selo].filter(Boolean).join(' '));
  if(/custo.?beneficio|beneficio/.test(explicit))return{label:'CUSTO-BENEFÍCIO',score:60};
  if(/entrada|econom|acessivel/.test(explicit))return{label:'OPÇÃO DE ENTRADA',score:50};
  if(/premium|topo|avancad/.test(explicit))return{label:'PREMIUM',score:40};
  if(/intermedi|equilibr/.test(explicit))return{label:'EQUILÍBRIO',score:35};
  if(/recomend|escolha|selecion/.test(explicit))return{label:'SELECIONADO',score:25};
  if(/destaque/.test(explicit)||product.destaque===true)return{label:'DESTAQUE',score:30};
  return{label:'SELECIONADO',score:20};
}
function reasonText(product){
  return String(product.chamada||product.resumo||'').trim();
}
function compareCandidates(a,b){
  const scoreA=criterion(a).score+(a.destaque===true?10:0);
  const scoreB=criterion(b).score+(b.destaque===true?10:0);
  if(scoreA!==scoreB)return scoreB-scoreA;
  return String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR');
}
function takeBalanced(candidates,limit,selected,brandCounts){
  const chosen=[];
  for(const maxPerBrand of [1,2,3,Number.POSITIVE_INFINITY]){
    for(const product of candidates){
      if(chosen.length>=limit)break;
      if(selected.some(item=>item.id===product.id)||chosen.some(item=>item.id===product.id))continue;
      const brand=norm(product.marca||'sem-marca');
      if((brandCounts.get(brand)||0)>=maxPerBrand)continue;
      chosen.push(product);
      brandCounts.set(brand,(brandCounts.get(brand)||0)+1);
    }
    if(chosen.length>=limit)break;
  }
  selected.push(...chosen);
}
function curate(products){
  const previousHighlights=products.filter(product=>product?.linkAfiliado&&product.destaque===true).length;
  const candidates=products
    .filter(product=>product?.linkAfiliado&&reasonText(product))
    .sort(compareCandidates);
  if(candidates.length<CURATION_TARGET)throw new Error(`Curadoria insuficiente: ${candidates.length} produtos elegíveis para meta ${CURATION_TARGET}.`);

  const selected=[];
  const brandCounts=new Map();
  for(const [group,quota] of Object.entries(BUCKET_QUOTAS)){
    takeBalanced(candidates.filter(product=>bucket(product)===group),quota,selected,brandCounts);
  }
  if(selected.length<CURATION_TARGET)takeBalanced(candidates,CURATION_TARGET-selected.length,selected,brandCounts);
  if(selected.length<CURATION_TARGET){
    for(const product of candidates){
      if(selected.length>=CURATION_TARGET)break;
      if(!selected.some(item=>item.id===product.id))selected.push(product);
    }
  }
  const curated=selected.slice(0,CURATION_TARGET).sort(compareCandidates);
  if(curated.length!==CURATION_TARGET)throw new Error(`Curadoria final inválida: ${curated.length}.`);
  return{previousHighlights,candidates,curated};
}
function card(product,index){
  const meta=criterion(product);
  return `<article class="pnm-offer-card" data-pnm-product-id="${esc(product.id)}"><div class="pnm-offer-image"><img ${imageAttrs(product,index)}><span>${esc(meta.label)}</span></div><div class="pnm-offer-copy"><small>${esc(product.marca||product.categoria||'Produto')}</small><h3>${esc(product.nome)}</h3><p><strong>Por que olhar:</strong> ${esc(reasonText(product))}</p><div><a href="${productUrl(product)}">ANALISAR</a><a class="hot" href="${esc(product.linkAfiliado||'#')}" target="_blank" rel="sponsored nofollow noopener noreferrer" aria-label="Ver ${esc(product.nome)} no Mercado Livre — abre em nova aba">VER NO MERCADO LIVRE ↗</a></div></div></article>`;
}
function pagePath(page){return page<=1?'ofertas':`ofertas-pagina-${page}`;}
function pageUrl(page){return `${ORIGIN}/${pagePath(page)}`;}
function pagination(page,totalPages){
  if(totalPages<=1)return '';
  const prev=page>1?`<a rel="prev" href="${pagePath(page-1)}">← ANTERIOR</a>`:'<span aria-hidden="true"></span>';
  const next=page<totalPages?`<a rel="next" href="${pagePath(page+1)}">PRÓXIMA →</a>`:'<span aria-hidden="true"></span>';
  return `<nav class="pnm-seo-pagination" aria-label="Paginação de Ofertas">${prev}<span class="pnm-seo-page-status">Página ${page} de ${totalPages}</span>${next}</nav>`;
}
function itemList(items,page){
  const schema={'@context':'https://schema.org','@type':'ItemList',name:`Curadoria do Preço na Mira — página ${page}`,itemListElement:items.map((product,index)=>({'@type':'ListItem',position:(page-1)*PAGE_SIZE+index+1,url:`${ORIGIN}/${productUrl(product)}`,name:product.nome}))};
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
  const title=page===1?'Ofertas — curadoria para descobrir — Preço na Mira':`Ofertas — curadoria para descobrir — Preço na Mira — Página ${page}`;
  html=html.replace(/<title>[^<]*<\/title>/i,`<title>${esc(title)}</title>`);
  html=html.replace(/<link\b(?=[^>]*\brel=(?:"canonical"|'canonical'))[^>]*>/i,`<link rel="canonical" href="${canonical}">`);
  html=html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:url"|'og:url'))[^>]*>/i,`<meta property="og:url" content="${canonical}">`);
  html=html.replace(/<meta\b(?=[^>]*\bproperty=(?:"og:title"|'og:title'))[^>]*>/i,`<meta property="og:title" content="${esc(title)}">`);
  html=html.replace(/<meta\b(?=[^>]*\bname=(?:"twitter:title"|'twitter:title'))[^>]*>/i,`<meta name="twitter:title" content="${esc(title)}">`);
  return html;
}

const products=readProducts();
const {previousHighlights,candidates,curated}=curate(products);
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
if(firstCards!==curated.length)throw new Error(`Ofertas prerenderizadas inválidas: ${firstCards}/${curated.length}.`);
const byBucket=Object.fromEntries(Object.keys(BUCKET_QUOTAS).map(group=>[group,curated.filter(product=>bucket(product)===group).length]));
const byCriterion=curated.reduce((acc,product)=>{const label=criterion(product).label;acc[label]=(acc[label]||0)+1;return acc;},{});
console.log(JSON.stringify({previousHighlights,candidatePool:candidates.length,curatedOffers:curated.length,offerPages:totalPages,firstPageCards:firstCards,byBucket,byCriterion,criterion:'prioriza destaques e critérios editoriais existentes; completa variedade por área e marca sem inventar dados'},null,2));
