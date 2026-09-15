export const assets = new Map([
  ['index.html','text/html'],['style.css','text/css'],['app.mjs','text/javascript'],
  ['model.mjs','text/javascript'],['demo-storage.mjs','text/javascript'],['mobile.mjs','text/javascript'],
  ['sw.js','text/javascript'],['manifest.webmanifest','application/manifest+json'],
  ['icon.svg','image/svg+xml'],['icon-180.png','image/png'],['icon-192.png','image/png'],['icon-512.png','image/png'],
  ['phone-guide.html','text/html'],
]);
export const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";
