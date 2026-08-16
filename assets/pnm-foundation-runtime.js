(()=>{
  const applyFallback=(img)=>{
    if(!(img instanceof HTMLImageElement))return;
    const primary=img.dataset.fallbackSrc;
    const placeholder=img.dataset.placeholderSrc||'assets/product-placeholder.svg';
    const current=img.getAttribute('src')||'';
    if(primary && img.dataset.fallbackApplied!=='1' && current!==primary){
      img.dataset.fallbackApplied='1';
      img.src=primary;
      return;
    }
    if(placeholder && img.dataset.placeholderApplied!=='1' && current!==placeholder){
      img.dataset.placeholderApplied='1';
      img.src=placeholder;
      return;
    }
    img.classList.add('pnm-image-broken');
  };
  document.addEventListener('error',e=>applyFallback(e.target),true);
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('img').forEach(img=>{
      if(!img.dataset.placeholderSrc)img.dataset.placeholderSrc='assets/product-placeholder.svg';
      if(!img.getAttribute('src'))applyFallback(img);
    });
  });
  document.addEventListener('submit',e=>{
    const form=e.target?.closest?.('form[data-pnm-submit]');
    if(!form)return;
    e.preventDefault();
    const fn=window[form.dataset.pnmSubmit];
    if(typeof fn==='function')fn.call(window);
  },true);
})();
