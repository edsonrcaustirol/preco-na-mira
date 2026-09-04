import fs from 'node:fs';

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`P1: padrão ausente em ${label}`);
  return source.replace(before, after);
}

function addSitemapUrl(xml, route) {
  const url = `https://preconamira.com.br/${route}`;
  if (xml.includes(`<loc>${url}</loc>`)) return xml;
  if (!xml.includes('</urlset>')) throw new Error('P1: sitemap sem </urlset>');
  return xml.replace('</urlset>', `  <url><loc>${url}</loc></url>\n</urlset>`);
}

const files = {
  guias: fs.readFileSync('guias.html', 'utf8'),
  guiaCaixa: fs.readFileSync('guia-caixa-de-som.html', 'utf8'),
  caixas: fs.readFileSync('caixas-de-som.html', 'utf8'),
  portateis: fs.readFileSync('melhores-portateis.html', 'utf8'),
  sitemap: fs.readFileSync('sitemap.xml', 'utf8'),
};

files.guias = mustReplace(
  files.guias,
  '{"@type":"WebPage","name":"5 melhores Air Fryers para comprar em 2026","url":"https://preconamira.com.br/melhores-air-fryers"}]',
  '{"@type":"WebPage","name":"5 melhores Air Fryers para comprar em 2026","url":"https://preconamira.com.br/melhores-air-fryers"},{"@type":"WebPage","name":"5 melhores caixas de som Bluetooth em 2026","url":"https://preconamira.com.br/melhores-caixas-de-som-bluetooth"},{"@type":"WebPage","name":"Philco PCX4800 vale a pena?","url":"https://preconamira.com.br/philco-pcx4800-vale-a-pena"}]',
  'guias.html JSON-LD',
);

files.guias = mustReplace(
  files.guias,
  '<a class="guide-card" href="melhores-air-fryers"><small>AIR FRYER • RANKING</small><h2>5 melhores Air Fryers para comprar em 2026</h2><p>Modelos de 4 L a 12 L separados por capacidade, formato e perfil de uso.</p><b>VER RANKING →</b></a></div><h2>Continue pela categoria certa</h2>',
  '<a class="guide-card" href="melhores-air-fryers"><small>AIR FRYER • RANKING</small><h2>5 melhores Air Fryers para comprar em 2026</h2><p>Modelos de 4 L a 12 L separados por capacidade, formato e perfil de uso.</p><b>VER RANKING →</b></a><a class="guide-card" href="melhores-caixas-de-som-bluetooth"><small>ÁUDIO • RANKING</small><h2>5 melhores caixas de som Bluetooth em 2026</h2><p>Portátil, ultracompacta, área externa e festa: modelos separados pelo tipo de uso.</p><b>VER RANKING →</b></a><a class="guide-card" href="philco-pcx4800-vale-a-pena"><small>PHILCO • ANÁLISE</small><h2>Philco PCX4800 vale a pena?</h2><p>Ficha técnica com contexto para entender bateria, IPX5, porte, microfone e proposta de festa compacta.</p><b>LER ANÁLISE →</b></a></div><h2>Continue pela categoria certa</h2>',
  'guias.html cards',
);

files.guiaCaixa = mustReplace(
  files.guiaCaixa,
  '<div class="guide-actions"><a class="primary" href="caixas-de-som">VER CAIXAS DE SOM</a><a href="comparativo-jbl">COMPARAR JBL</a><a href="comparativo-philips">COMPARAR PHILIPS</a></div>',
  '<div class="guide-actions"><a class="primary" href="melhores-caixas-de-som-bluetooth">VER TOP 5 DE 2026</a><a href="caixas-de-som">VER CAIXAS DE SOM</a><a href="philco-pcx4800-vale-a-pena">PCX4800 VALE A PENA?</a><a href="comparativo-jbl">COMPARAR JBL</a><a href="comparativo-philips">COMPARAR PHILIPS</a></div>',
  'guia-caixa-de-som.html actions',
);

files.caixas = mustReplace(files.caixas, 'href="guia-caixa-som"', 'href="guia-caixa-de-som"', 'caixas-de-som.html URL do guia');
files.caixas = mustReplace(
  files.caixas,
  '<a class="mini-card" href="melhores-festa"><div class="mini-icon">🎉</div><h3>Caixas para festa</h3><p>Party speakers e torres organizadas por perfil.</p></a>',
  '<a class="mini-card" href="melhores-festa"><div class="mini-icon">🎉</div><h3>Caixas para festa</h3><p>Party speakers e torres organizadas por perfil.</p></a><a class="mini-card" href="melhores-caixas-de-som-bluetooth"><div class="mini-icon">🏆</div><h3>5 melhores caixas Bluetooth em 2026</h3><p>Uma seleção por perfil de uso, da mochila à festa maior.</p></a><a class="mini-card" href="philco-pcx4800-vale-a-pena"><div class="mini-icon">🔎</div><h3>Philco PCX4800 vale a pena?</h3><p>Entenda onde bateria, IPX5, microfone e porte fazem sentido.</p></a>',
  'caixas-de-som.html cards',
);
files.caixas = mustReplace(
  files.caixas,
  '<strong>Projeto em desenvolvimento:</strong> o site continua configurado para não ser indexado por buscadores enquanto revisamos divulgação e políticas.',
  '<strong>Projeto em evolução:</strong> as páginas públicas são indexáveis e seguimos ampliando guias, comparações e transparência editorial.',
  'caixas-de-som.html aviso antigo',
);

if (!files.portateis.includes('melhores-caixas-de-som-bluetooth')) {
  files.portateis = mustReplace(
    files.portateis,
    '</main>',
    '<section class="section"><div class="container"><div class="compare-cta"><div><strong>Quer uma seleção por tipo de uso?</strong><span>Veja o ranking geral de 2026 e depois aprofunde portabilidade, resistência e festa.</span></div><a class="btn btn-dark" href="melhores-caixas-de-som-bluetooth">VER TOP 5 DE 2026 →</a></div><p style="margin-top:14px"><a href="guia-caixa-de-som">Leia também: como escolher caixa de som Bluetooth sem olhar só watts.</a></p></div></section></main>',
    'melhores-portateis.html CTA',
  );
}

files.sitemap = files.sitemap.replace(
  '<loc>https://preconamira.com.br/guia-caixa-som</loc>',
  '<loc>https://preconamira.com.br/guia-caixa-de-som</loc>',
);
for (const route of [
  'guias',
  'guia-como-escolher-air-fryer',
  'guia-robo-aspirador',
  'melhores-tvs',
  'melhores-notebooks',
  'melhores-air-fryers',
  'melhores-caixas-de-som-bluetooth',
  'philco-pcx4800-vale-a-pena',
]) {
  files.sitemap = addSitemapUrl(files.sitemap, route);
}

if (files.sitemap.includes('https://preconamira.com.br/guia-caixa-som</loc>')) throw new Error('P1: URL antiga do guia permaneceu no sitemap');

fs.writeFileSync('guias.html', files.guias);
fs.writeFileSync('guia-caixa-de-som.html', files.guiaCaixa);
fs.writeFileSync('caixas-de-som.html', files.caixas);
fs.writeFileSync('melhores-portateis.html', files.portateis);
fs.writeFileSync('sitemap.xml', files.sitemap);

console.log(JSON.stringify({
  ok: true,
  links: ['guias', 'guia-caixa-de-som', 'caixas-de-som', 'melhores-portateis'],
  sitemapEditorial: 8,
  oldGuideUrlRemoved: true,
}, null, 2));
