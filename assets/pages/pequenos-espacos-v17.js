(() => {
  "use strict";
  const fallback = "assets/product-photo-unavailable.svg";
  const data = {
    sala: ["SALA COMPACTA", "Tela pequena, decisão simples.", "Duas TVs de 32″ já cadastradas no Preço na Mira. Uma seleção curta para quem não precisa de uma tela grande ocupando a parede.", "Priorizar tamanho de 32″ e plataformas smart já validadas no catálogo.", [
      ["philips-32phg6910", "Philips 32PHG6910/78 32” HD", "Philips", "TV 32″", "assets/produtos/philips-32phg6910.webp", "https://meli.la/2MK33T4", "32″ • HD • Titan OS • Dolby Audio"],
      ["philco-p32crb", "Philco P32CRB 32” Roku TV", "Philco", "TV 32″", "assets/produtos/philco-p32crb.webp", "https://meli.la/1SDh4Wc", "32″ • HD • Roku TV • Dolby Audio"]
    ]],
    cozinha: ["COZINHA COMPACTA", "Mais função sem transformar a bancada em depósito.", "Três produtos do catálogo com proposta coerente para pouco espaço: cocção portátil, micro-ondas de 20 L e lava-louças de 8 serviços classificada como compacta.", "Preferir formatos portáteis, menor capacidade física ou cadastro explicitamente marcado para pouco espaço.", [
      ["philco-pct10a-cooktop-de-inducao-1-boca-portatil", "Philco PCT10A Cooktop de Indução 1 Boca Portátil", "Philco", "Cooktop de indução", "https://http2.mlstatic.com/D_NQ_NP_845092-MLA99504512104_112025-O.webp", "https://meli.la/2iDVnWB", "1 boca • portátil • confirme tensão e instalação"],
      ["electrolux-mto30-micro-ondas-20l-branco", "Electrolux MTO30 Micro-ondas 20L Branco", "Electrolux", "Micro-ondas", "https://http2.mlstatic.com/D_NQ_NP_787358-MLA100187065347_122025-O.webp", "https://meli.la/2FNsDcY", "20 L • bancada • confirme tensão e medidas"],
      ["midea-touch-plus-lava-loucas-8-servicos", "Lava-louças Midea Touch Plus 8 Serviços Cinza", "Midea", "Lava-louças", "assets/produtos/midea-touch-plus-lava-loucas-8-servicos.webp", "https://meli.la/1mEGQzb", "8 serviços • perfil compacto • instalação a confirmar"]
    ]],
    office: ["HOME OFFICE COMPACTO", "Leve o computador com você — não prenda o espaço a ele.", "Três notebooks reais do catálogo para trabalhar sem reservar área permanente para gabinete e torre.", "Priorizar notebooks de produtividade e mobilidade; confirme a configuração exata no anúncio.", [
      ["lenovo-yoga-slim7i-ultra7", "Lenovo Yoga Slim 7i Core Ultra 7", "Lenovo", "Notebook", "https://http2.mlstatic.com/D_NQ_NP_954460-MLA101696041079_122025-O.webp", "https://meli.la/1UbtuXB", "14″ • 32 GB • SSD 1 TB • foco em mobilidade"],
      ["dell-xps13-intel-ultra7", "Dell XPS 13 Intel Core Ultra 7", "Dell", "Notebook", "assets/produtos/dell-xps13-intel-ultra7.webp", "https://meli.la/2X2f9Xa", "13,4″ • Core Ultra 7 • ultraportátil"],
      ["notebook-samsung-galaxy-book4-intel-u300-1-20-ghz-ate-4-4ghz-8-mb-l3-cache-windows-11-home-8", "Notebook Samsung Galaxy Book4 Intel U300 8GB 256GB SSD 15,6″ Full HD", "Samsung", "Notebook", "assets/produtos/notebook-samsung-galaxy-book4-intel-u300-1-20-ghz-ate-4-4ghz-8-mb-l3-cache-windows-11-home-8-anuncio.webp", "https://meli.la/2EvDUaG", "15,6″ Full HD • 8 GB • SSD 256 GB • 1,55 kg"]
    ]]
  };
  const $ = (id) => document.getElementById(id);
  const tabs = [...document.querySelectorAll(".ps-journey-tab")];
  const panel = $("journeyPanel"), products = $("journeyProducts");
  if (!panel || !products || !tabs.length) return;

  const card = ([id, name, brand, category, src, href, note]) => {
    const el = document.createElement("article");
    el.className = "ps-product-card";
    el.dataset.productId = id;
    el.innerHTML = `<div class="ps-product-media"><img alt="" loading="lazy" decoding="async" width="640" height="480"></div><div class="ps-product-body"><div class="ps-product-meta"><span></span><span></span></div><h4></h4><p></p><div class="ps-product-actions"><a class="ps-btn primary" target="_blank" rel="nofollow sponsored noopener">VER PRODUTO →</a><a class="ps-text-link" href="catalogo">Ver no Catálogo</a></div></div>`;
    const img = el.querySelector("img");
    img.src = src; img.alt = `Foto do produto ${name}`;
    img.addEventListener("error", () => { if (img.src.endsWith(fallback)) return; img.src = fallback; }, { once: true });
    const meta = el.querySelectorAll(".ps-product-meta span"); meta[0].textContent = brand; meta[1].textContent = category;
    el.querySelector("h4").textContent = name; el.querySelector(".ps-product-body > p").textContent = note;
    const buy = el.querySelector(".ps-btn.primary"); buy.href = href; buy.setAttribute("aria-label", `Ver ${name} no Mercado Livre`);
    return el;
  };

  const render = (key, focus = false) => {
    const j = data[key]; if (!j) return;
    $("journeyKicker").textContent = j[0]; $("journeyTitle").textContent = j[1]; $("journeyDescription").textContent = j[2]; $("journeyPrinciple").textContent = j[3];
    products.dataset.count = String(j[4].length); products.replaceChildren(...j[4].map(card));
    tabs.forEach((tab) => { const on = tab.dataset.journey === key; tab.classList.toggle("is-active", on); tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1; });
    panel.setAttribute("aria-labelledby", `journey-${key}`); if (focus) panel.focus({ preventScroll: true });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => render(tab.dataset.journey, true));
    tab.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); let n = i;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length; if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length; if (e.key === "Home") n = 0; if (e.key === "End") n = tabs.length - 1;
      tabs[n].focus(); render(tabs[n].dataset.journey);
    });
  });
  render("sala");
})();
