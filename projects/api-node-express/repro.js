import sharp from 'sharp';
import FormData from 'form-data';
import http from 'http';

async function repro() {
  const buf = await sharp({create:{width:200,height:150,channels:4,background:'#39ff14'}}).png().toBuffer();
  const form = new FormData();
  form.append('image', buf, {filename:'test.png', contentType:'image/png'});
  form.append('config', JSON.stringify({palette:'pico8',block:8}));

  const opts = {hostname:'localhost',port:3000,path:'/process/pixel',method:'POST',headers:form.getHeaders()};
  const req = http.request(opts, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, data.substring(0,500)));
  });
  req.on('error', e => console.error('REQ ERR:', e.message));
  form.pipe(req);
}
repro();
