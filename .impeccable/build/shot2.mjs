import puppeteer from "puppeteer";
const out = process.argv[2];
const b = await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const erros = [];
for (const [w,h,tag] of [[1440,900,"d"],[390,844,"m"]]) {
  const p = await b.newPage(); await p.setViewport({width:w,height:h}); await p.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"no-preference"}]);
  p.on("console", m => m.type()==="error" && erros.push(tag+": "+m.text().slice(0,200)));
  p.on("pageerror", e => erros.push(tag+" pageerror: "+e.message.slice(0,200)));
  await p.goto("http://localhost:3100/",{waitUntil:"networkidle2",timeout:90000});
  await new Promise(r=>setTimeout(r,3500));
  await p.screenshot({path:`${out}/l0-${tag}.png`});
  const H = await p.evaluate(()=>document.documentElement.scrollHeight);
  const marcas = [0.6, 1.4, 2.3, 3.0].map(k=>Math.round(k*h));
  for (const [i,y] of marcas.entries()) { await p.evaluate(y=>window.scrollTo(0,y), y); await new Promise(r=>setTimeout(r,1300)); await p.screenshot({path:`${out}/l${i+1}-${tag}.png`}); }
  for (const [i,y] of [H-2.2*h, H-h].entries()) { await p.evaluate(y=>window.scrollTo(0,y), y); await new Promise(r=>setTimeout(r,1600)); await p.screenshot({path:`${out}/lz${i}-${tag}.png`}); }
  await p.goto("http://localhost:3100/login",{waitUntil:"networkidle2"}); await new Promise(r=>setTimeout(r,2500));
  await p.screenshot({path:`${out}/login-${tag}.png`});
  await p.close();
}
console.log(erros.join("\n")||"sem erros no console");
await b.close();
