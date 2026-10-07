import { JSDOM } from 'jsdom';

async function check() {
  try {
    const dom = await JSDOM.fromURL("http://localhost:3000/", {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true
    });

    console.log("Waiting 5 seconds for React to mount...");
    await new Promise(r => setTimeout(r, 5000));

    const _html = dom.window.document.documentElement.innerHTML;
    const body = dom.window.document.body.innerHTML;
    const text = dom.window.document.body.textContent;
    
    console.log("Body length:", body.length);
    console.log("Visible text:", text.trim().substring(0, 500));
    console.log("Any errors?:", dom.window.errors || []);
  } catch(e) {
    console.error("JSDOM Error:", e);
  }
}

check();
