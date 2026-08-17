#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const sitemapPath=path.join(ROOT,'sitemap.xml');
const robotsPath=path.join(ROOT,'robots.txt');
const today=new Date().toISOString().slice(0,10);
if(!fs.existsSync(sitemapPath))throw new Error('sitemap.xml não foi gerado.');
if(!fs.existsSync(robotsPath))throw new Error('robots.txt não foi gerado.');
let sitemap=fs.readFileSync(sitemapPath,'utf8').replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g,`<lastmod>${today}</lastmod>`);
const required=['https://preconamira.com.br/','https://preconamira.com.br/catalogo','https://preconamira.com.br/ofertas','https://preconamira.com.br/universos'];
for(const url of required){if(!sitemap.includes(`<loc>${url}</loc>`))throw new Error(`URL essencial ausente do sitemap: ${url}`)}
const productUrls=(sitemap.match(/<loc>https:\/\/preconamira\.com\.br\/produto-[^<]+<\/loc>/g)||[]).length;
if(productUrls===0)throw new Error('Nenhuma página de produto encontrada no sitemap.');
const paginationUrls=(sitemap.match(/<loc>https:\/\/preconamira\.com\.br\/(?:catalogo|ofertas)-pagina-\d+<\/loc>/g)||[]).length;
const totalUrls=(sitemap.match(/<url>/g)||[]).length;
fs.writeFileSync(sitemapPath,sitemap);
const robots=fs.readFileSync(robotsPath,'utf8');
if(!robots.includes('Sitemap: https://preconamira.com.br/sitemap.xml'))throw new Error('robots.txt não aponta para o sitemap oficial.');
console.log(JSON.stringify({lastmod:today,totalUrls,productUrls,paginationUrls,robotsSitemap:true},null,2));
