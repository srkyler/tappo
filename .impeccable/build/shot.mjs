import puppeteer from "puppeteer";
const [,, out, ...routes] = process.argv;
const b = await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
for (const r of routes) {
  for (const [w,h,tag] of [[1440,900,"d"],[390,844,"m"]]) {
    const p = await b.newPage(); await p.setViewport({width:w,height:h});
    try { await p.goto("http://localhost:3100"+r,{waitUntil:"networkidle2",timeout:60000}); } catch(e){console.log(r,e.message)}
    await new Promise(r=>setTimeout(r,1500));
    await p.screenshot({path:`${out}/${r.replace(/\W/g,"_")||"home"}-${tag}.png`, fullPage: tag==="d"});
    await p.close();
  }
}
await b.close();
