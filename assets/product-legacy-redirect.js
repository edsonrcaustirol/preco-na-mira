(()=>{const id=new URLSearchParams(location.search).get('id');location.replace(id?'produto-'+encodeURIComponent(id):'catalogo')})();
