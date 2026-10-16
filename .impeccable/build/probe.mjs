import puppeteer from "puppeteer";
const b = await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe"});
const p = await b.newPage(); await p.setViewport({width:1440,height:900});
await p.goto("http://localhost:3100/",{waitUntil:"networkidle2"});
console.log(await p.evaluate(()=>{const e=document.querySelector(".ficha-card"); const c=getComputedStyle(e); return JSON.stringify({bg:c.backgroundColor, img:c.backgroundImage.slice(0,300), sheets:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return []}}).flatMap(r=>r.cssRules?[...r.cssRules]:[r]).filter(r=>r.selectorText===".ficha-card").map(r=>r.cssText.slice(0,160)), op:c.opacity, color:c.color, mix:c.mixBlendMode, parentOp:getComputedStyle(e.parentElement).opacity});}));
await b.close();
