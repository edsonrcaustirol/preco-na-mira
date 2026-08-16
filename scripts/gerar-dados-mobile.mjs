import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('data/produtos-index.js', root), 'utf8');
const box = {};
vm.createContext(box);
vm.runInContext(`${source}\nthis.__products = PRODUTOS;`, box);
const fields = ['id','nome','marca','categoria','categoriaId','tipoProduto','imagem','imagemFallback','imagemAlt','imagemTipo','linkAfiliado','destaque','faixa','selo','chamada','resumo','subtipo','subtipoCasa','subtipoCozinha','subtipoLavanderia','subtipoGamer','subtipoAcessorio','subtipoObra','subtipoInstalacao','subtipoAcabamento','porteEspaco'];
const compact = box.__products.map(product => Object.fromEntries(fields.filter(key => product[key] !== undefined).map(key => [key, product[key]])));
const output = `/* Gerado automaticamente por scripts/gerar-dados-mobile.mjs. */\nconst PRODUTOS = ${JSON.stringify(compact)};\n`;
fs.writeFileSync(new URL('data/produtos-mobile.js', root), output);
console.log(`Catálogo móvel: ${compact.length} produtos, ${Buffer.byteLength(output)} bytes.`);
