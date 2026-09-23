const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'engineering');
const data = {practice:JSON.parse(fs.readFileSync(path.join(folder,'practice.json'),'utf8')),csharp:JSON.parse(fs.readFileSync(path.join(folder,'csharp-lessons.json'),'utf8')),guide:JSON.parse(fs.readFileSync(path.join(folder,'delivery-guide.json'),'utf8'))};
let html = fs.readFileSync(path.join(folder,'index.html'),'utf8');
html = html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';");
html = html.replace('<link rel="stylesheet" href="studio.css">', () => '<style>'+fs.readFileSync(path.join(folder,'studio.css'),'utf8')+'</style>');
html = html.replace('<script src="vendor/qrcode.js" defer></script>', () => '<script>globalThis.STUDIO_DATA='+JSON.stringify(data).replace(/</g,'\\u003c')+';</script><script src="vendor/qrcode.js" defer></script>');
html = html.replace(/<script src="([^"]+)" defer><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(path.join(folder,file),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
// Keep script execution deferred until all the body elements exist.
const scripts=[];html=html.replace(/<script>[\s\S]*?<\/script>/g,s=>{scripts.push(s);return '';});
html=html.replace('</body>',()=>scripts.join('\n')+'\n</body>');
fs.writeFileSync(path.join(root,'Open Engineering Studio.html'),html);
console.log('Standalone browser workspace built: '+Buffer.byteLength(html)+' bytes.');
