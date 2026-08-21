const fs = require("fs");
const path = require("path");
const root = process.cwd();

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}
function write(name, value) {
  fs.writeFileSync(path.join(root, name), value, "utf8");
}
function patch(name, replacements) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return;
  let text = read(name);
  const before = text;
  for (const [from, to] of replacements) {
    text = from instanceof RegExp ? text.replace(from, to) : text.split(from).join(to);
  }
  if (text !== before) {
    write(name, text);
    console.log("patched", name);
  }
}

patch("global-shell.js", [
  ['label: "Template Downloader"', 'label: "Clothing"'],
  ['label: "UGC Downloader"', 'label: "UGC"'],
  ['label: "Media Downloader"', 'label: "Media"'],
  ['label: "Audio Downloader"', 'label: "Audio"'],
  ['label: "Animation Spoofer"', 'label: "Animations"'],
  ['{ name: "Template Downloader", desc: "Download supported Roblox clothing templates fast.", href: "./template-downloader", plus: false, icon: "spark", tag: "Template Tool"', '{ name: "Clothing", desc: "Access supported Roblox clothing templates fast.", href: "./template-downloader", plus: false, icon: "spark", tag: "Clothing Tool"'],
  ['{ name: "UGC Downloader", desc: "Download supported UGC accessory files for creator workflows.", href: "./ugc-downloader", plus: false, icon: "hat", tag: "UGC Tool"', '{ name: "UGC", desc: "Access supported UGC accessory files for creator workflows.", href: "./ugc-downloader", plus: false, icon: "hat", tag: "UGC Tool"'],
  ['{ name: "Media Downloader", desc: "Pull supported media assets quickly.", href: "./media-downloader", plus: false, icon: "media", tag: "Media Tool"', '{ name: "Media", desc: "Access supported media assets quickly.", href: "./media-downloader", plus: false, icon: "media", tag: "Media Tool"'],
  ['{ name: "Audio Downloader", desc: "Fetch audio asset files from supported IDs.", href: "./audio-downloader", plus: false, icon: "audio", tag: "Audio Tool"', '{ name: "Audio", desc: "Fetch audio asset files from supported IDs.", href: "./audio-downloader", plus: false, icon: "audio", tag: "Audio Tool"'],
  ['{ name: "Animation Spoofer", desc: "Premium animation utility for advanced workflows.", href: "./animation-spoofer", plus: true, icon: "rig", tag: "Plus Tool"', '{ name: "Animations", desc: "Premium animation utility for advanced workflows.", href: "./animation-spoofer", plus: true, icon: "rig", tag: "Plus Tool"']
]);

let shellJs = read("global-shell.js");

if (!shellJs.includes("function buildFooterMarkup() {")) {
  const footerFns = `
  function buildFooterLinkGroupMarkup(title, items) {
    if (!Array.isArray(items) || !items.length) return "";
    var links = items.map(function (item) {
      return '<a href="' + item.href + '">' + escapeHtml(item.label) + "</a>";
    }).join("");
    return (
      '<section class="rblx-shell-footer-group">' +
        '<h3 class="rblx-shell-footer-title">' + escapeHtml(title) + "</h3>" +
        '<div class="rblx-shell-footer-links">' + links + "</div>" +
      "</section>"
    );
  }

  function buildFooterMarkup() {
    var year = new Date().getFullYear();
    return (
      '<footer class="rblx-shell-footer">' +
        '<div class="rblx-shell-footer-top">' +
          '<section class="rblx-shell-footer-brand">' +
            '<div class="rblx-shell-footer-kicker">RBLXTools</div>' +
            '<h2>Creator tools, cleaner workflows, and community support.</h2>' +
            '<p>Browse the full site faster, jump between creator pages, and support future free updates from one place.</p>' +
            '<div class="rblx-shell-footer-actions">' +
              '<a class="rblx-shell-footer-action is-primary" href="./subscriptions">View Plans</a>' +
              '<a class="rblx-shell-footer-action" href="https://ko-fi.com/rblxtools" target="_blank" rel="noopener noreferrer">Support RBLXTools</a>' +
            "</div>" +
          "</section>" +
          '<div class="rblx-shell-footer-grid">' +
            buildFooterLinkGroupMarkup("Tools", [
              { href: "./index", label: "Home" },
              { href: "./template-downloader", label: "Clothing" },
              { href: "./template-background-changer", label: "Background Changer" },
              { href: "./ugc-downloader", label: "UGC" },
              { href: "./media-downloader", label: "Media" },
              { href: "./audio-downloader", label: "Audio" },
              { href: "./robux-calculator", label: "Robux Calculator" },
              { href: "./animation-spoofer", label: "Animations" }
            ]) +
            buildFooterLinkGroupMarkup("Account", [
              { href: "./subscriptions", label: "Subscriptions" },
              { href: "./account-overview", label: "Account Overview" },
              { href: "./login", label: "Login / Sign Up" }
            ]) +
            buildFooterLinkGroupMarkup("Info", [
              { href: "./about-us", label: "About Us" },
              { href: "./privacy-policy", label: "Privacy Policy" },
              { href: "./terms-and-conditions", label: "Terms & Conditions" }
            ]) +
            '<section class="rblx-shell-footer-group">' +
              '<h3 class="rblx-shell-footer-title">Community</h3>' +
              '<div class="rblx-shell-footer-links">' +
                '<a href="https://discord.gg/j5JbFdj47Q" target="_blank" rel="noopener noreferrer">Discord</a>' +
                '<a href="https://x.com/Reese28575571" target="_blank" rel="noopener noreferrer">X</a>' +
                '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noopener noreferrer">YouTube</a>' +
                '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noopener noreferrer">Twitch</a>' +
              "</div>" +
              '<div class="rblx-shell-footer-socials">' +
                '<a href="https://discord.gg/j5JbFdj47Q" target="_blank" rel="noopener noreferrer" aria-label="Discord">' + getSocialIcon("discord") + "</a>" +
                '<a href="https://x.com/Reese28575571" target="_blank" rel="noopener noreferrer" aria-label="X">' + getSocialIcon("x") + "</a>" +
                '<a href="https://www.youtube.com/@ItzReeseRBLX" target="_blank" rel="noopener noreferrer" aria-label="YouTube">' + getSocialIcon("youtube") + "</a>" +
                '<a href="https://www.twitch.tv/2muchreese" target="_blank" rel="noopener noreferrer" aria-label="Twitch">' + getSocialIcon("twitch") + "</a>" +
              "</div>" +
            "</section>" +
          "</div>" +
        "</div>" +
        '<div class="rblx-shell-footer-bottom">' +
          '<span>© ' + year + ' RBLXTools. All rights reserved.</span>' +
          '<span>Built for Roblox creator workflows, cleaner access, and easier navigation.</span>' +
        "</div>" +
      "</footer>"
    );
  }
`;
  shellJs = shellJs.replace("  function buildAuthMarkup() {", footerFns + "\n  function buildAuthMarkup() {");
}

shellJs = shellJs.replace(
`          '<main class="rblx-shell-center">' +
            '<div class="rblx-shell-page" id="rblxShellPage"></div>' +
          "</main>" +`,
`          '<main class="rblx-shell-center">' +
            '<div class="rblx-shell-page" id="rblxShellPage"></div>' +
            buildFooterMarkup() +
          "</main>" +`
);

write("global-shell.js", shellJs);

let shellCss = read("global-shell.css");
shellCss = shellCss.replace(
`.rblx-shell-center {
  min-width: 0;
  padding: 18px;
}`,
`.rblx-shell-center {
  min-width: 0;
  padding: 18px;
  display: grid;
  gap: 18px;
}`
);

if (!shellCss.includes(".rblx-shell-footer {")) {
  shellCss += `

.rblx-shell-footer{border-radius:28px;border:1px solid rgba(255,255,255,.06);background:radial-gradient(circle at top right,rgba(137,92,255,.12),transparent 26%),linear-gradient(180deg,rgba(17,21,34,.98),rgba(12,15,26,.98));box-shadow:0 24px 60px rgba(5,8,14,.32);overflow:hidden}
.rblx-shell-footer-top{display:grid;grid-template-columns:minmax(260px,1.1fr) minmax(0,1.4fr);gap:24px;padding:28px}
.rblx-shell-footer-brand{display:grid;align-content:start;gap:14px}
.rblx-shell-footer-kicker{display:inline-flex;align-items:center;width:fit-content;min-height:28px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#ffd2df;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
.rblx-shell-footer-brand h2{margin:0;color:#fff7fb;font-size:clamp(28px,3vw,40px);line-height:.98;letter-spacing:-.04em}
.rblx-shell-footer-brand p{margin:0;max-width:520px;color:rgba(232,236,249,.76);font-size:14px;line-height:1.7;font-weight:600}
.rblx-shell-footer-actions{display:flex;flex-wrap:wrap;gap:12px}
.rblx-shell-footer-action{min-height:46px;padding:0 16px;border-radius:14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:#eef3ff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}
.rblx-shell-footer-action.is-primary{border-color:rgba(255,111,111,.34);background:linear-gradient(180deg,rgba(255,74,74,.96),rgba(211,28,28,.96));color:#fff7f7;box-shadow:0 16px 34px rgba(183,33,33,.28)}
.rblx-shell-footer-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
.rblx-shell-footer-group{min-width:0;padding:18px;border-radius:20px;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.025)}
.rblx-shell-footer-title{margin:0 0 12px;color:#fff;font-size:13px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
.rblx-shell-footer-links{display:grid;gap:10px}
.rblx-shell-footer-links a{color:rgba(227,232,245,.82);text-decoration:none;font-size:13px;line-height:1.4;font-weight:700}
.rblx-shell-footer-socials{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}
.rblx-shell-footer-socials a{min-height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.04);color:#f3f7ff;text-decoration:none;display:grid;place-items:center}
.rblx-shell-footer-socials svg{width:18px;height:18px;fill:currentColor}
.rblx-shell-footer-bottom{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px 18px;padding:16px 28px 22px;border-top:1px solid rgba(255,255,255,.06);color:rgba(210,218,235,.62);font-size:12px;line-height:1.5;font-weight:700}
@media (max-width:1100px){.rblx-shell-footer-top{grid-template-columns:1fr}.rblx-shell-footer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:720px){.rblx-shell-footer-top{padding:20px}.rblx-shell-footer-grid{grid-template-columns:1fr}.rblx-shell-footer-group{padding:16px}.rblx-shell-footer-bottom{padding:14px 20px 18px;flex-direction:column}.rblx-shell-footer-socials{grid-template-columns:repeat(4,42px)}}
`;
}
write("global-shell.css", shellCss);

const files = [
  "about-us.html",
  "animation-spoofer.html",
  "audio-downloader.html",
  "game-launcher.html",
  "index.html",
  "media-downloader.html",
  "privacy-policy.html",
  "subscriptions.html",
  "template-background-changer.html",
  "template-downloader.html",
  "terms-and-conditions.html",
  "ugc-downloader.html",
  "app.js",
  "server.js"
];

for (const file of files) {
  patch(file, [
    [/Template Downloader/g, "Clothing"],
    [/template downloader/g, "clothing"],
    [/UGC Downloader/g, "UGC"],
    [/ugc downloader/g, "ugc"],
    [/Media Downloader/g, "Media"],
    [/media downloader/g, "media"],
    [/Audio Downloader/g, "Audio"],
    [/audio downloader/g, "audio"],
    [/Animation Spoofer/g, "Animations"],
    [/animation spoofer/g, "animations"],
    [/Animation Downloader/g, "Animation Tools"],
    [/animation downloader/g, "animation tools"],
    [/Bulk downloads and bulk tool usage/g, "Bulk actions and faster tool usage"],
    [/Clothing Downloader/g, "Clothing Tool"],
    [/OBJ Downloader/g, "UGC Tool"],
    [/download helpers/g, "creator helpers"],
    [/downloaders/g, "tools"],
    [/Grab supported Roblox media assets/g, "Access supported Roblox media assets"],
    [/Upload an OBJ file exported from your downloader\./g, "Upload an OBJ file exported from your creator workflow."],
    [/Grab the texture from a Roblox UGC asset ID, upload the same 3D model from your downloader, then bake and export either a Blender-ready OBJ zip or a single-file GLB\./g, "Use a Roblox UGC asset ID, upload the same 3D model from your creator workflow, then bake and export either a Blender-ready OBJ zip or a single-file GLB."]
  ]);
}

patch("template-downloader.html", [
  ['<h1><span>Roblox Template</span><span>Downloader</span></h1>', '<h1><span>Roblox Clothing</span><span>Tool</span></h1>'],
  ['<h2><span>Template</span><span>Downloader</span></h2>', '<h2><span>Clothing</span><span>Tool</span></h2>'],
  ['tool: "Clothing Tool"', 'tool: "Clothing"']
]);

patch("ugc-downloader.html", [
  ['<h1><span>Roblox UGC OBJ</span><span>Downloader</span></h1>', '<h1><span>Roblox</span><span>UGC</span></h1>'],
  ['Preview and download supported Roblox UGC accessories as OBJ files using the exact same overall page layout as template-downloader.', 'Preview and access supported Roblox UGC accessories as OBJ files using the same overall page layout as the clothing tool.'],
  ['<span>UGC Tool</span>', '<span>UGC</span>']
]);

patch("media-downloader.html", [
  ['<h1><span>Roblox Media</span><span>Downloader</span></h1>', '<h1><span>Roblox</span><span>Media</span></h1>'],
  ['<span>Downloader</span>', '<span>Media</span>']
]);

patch("audio-downloader.html", [
  ['<h1><span>Roblox Audio</span><span>Downloader</span></h1>', '<h1><span>Roblox</span><span>Audio</span></h1>'],
  ['<span>Downloader</span>', '<span>Audio</span>']
]);

patch("animation-spoofer.html", [
  ['<h1><span>Roblox Animation</span><span>Spoofer</span></h1>', '<h1><span>Roblox</span><span>Animations</span></h1>'],
  ['<span>Spoofer</span>', '<span>Animations</span>']
]);

console.log("done");
