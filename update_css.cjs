const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

// Replace color-scheme
css = css.replace('color-scheme: light dark;', 'color-scheme: light;');

// Remove the dark media query completely
const darkMediaQueryStr = `
@media (prefers-color-scheme: dark) {
  :root {
    --c-primary: #818cf8;
    --c-accent:  #a78bfa;
    --c-bg: #0f172a;
    --c-text: #f8fafc;
  }
  ::-webkit-scrollbar-track { background: #1e293b; }
  ::-webkit-scrollbar-thumb { background: #475569; border: 2px solid #1e293b; }
  ::-webkit-scrollbar-thumb:hover { background: #64748b; }
}`;
css = css.replace(darkMediaQueryStr, `
/* Hardcode light mode to prevent textareas/inputs from turning black */
input, textarea, select {
  background-color: transparent;
  color: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
button:active {
  transform: scale(0.97);
}
`);

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('CSS updated');
