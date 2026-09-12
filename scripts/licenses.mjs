import fs from 'node:fs/promises';
const dest = 'public/licenses'; await fs.mkdir(dest,{recursive:true});
for(const [source,target] of [
 ['node_modules/@coderline/alphatab/LICENSE','alphaTab-MPL-2.0.txt'],
 ['node_modules/@coderline/alphatab/LICENSE.header','alphaTab-third-party.txt'],
 ['node_modules/@coderline/alphatab/dist/soundfont/LICENSE','SONiVOX-Apache-2.0.txt'],
 ['node_modules/@coderline/alphatab/dist/soundfont/README.md','SONiVOX-README.md'],
 ['node_modules/@breezystack/lamejs/LICENSE','lamejs-notice.txt'],
 ['node_modules/react/LICENSE','React-MIT.txt'],
 ['node_modules/react-dom/LICENSE','React-DOM-MIT.txt']]) await fs.copyFile(source,`${dest}/${target}`);
