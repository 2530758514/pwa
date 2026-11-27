import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { facebookShareImagePlugin } from '../scripts/facebook-share-image.mjs'

test('share image metadata is present in server HTML without Vue or API calls', () => {
  const plugin=facebookShareImagePlugin({VITE_FACEBOOK_SHARE_IMAGE_URL:'https://spinvibe777.spin7m.com/share/facebook-cover.png?v=2'})
  const tags=plugin.transformIndexHtml()
  const properties=Object.fromEntries(tags.map(tag=>[tag.attrs.property,tag.attrs.content]))
  assert.equal(properties['og:image'],'https://spinvibe777.spin7m.com/share/facebook-cover.png?v=2')
  assert.equal(properties['og:image:secure_url'],properties['og:image'])
  assert.equal(properties['og:image:width'],'800')
  assert.equal(properties['og:image:height'],'480')
  assert.equal(properties['og:image:type'],'image/png')
  assert.equal(properties['og:title'],'')
  assert.ok(tags.every(tag=>tag.injectTo==='head'))
})
test('unconfigured image retains the empty server-replaceable title without a placeholder', () => {
  const tags=facebookShareImagePlugin({}).transformIndexHtml()
  assert.deepEqual(tags.map(tag=>tag.attrs),[{property:'og:title',content:''}])
})
test('share image URL must be a public HTTPS address', () => {
  for (const value of ['http://cdn.test/cover.png','/share/cover.png','javascript:alert(1)','https://user:pass@cdn.test/cover.png']) assert.throws(()=>facebookShareImagePlugin({VITE_FACEBOOK_SHARE_IMAGE_URL:value}))
})
test('bundled user PNG has the dimensions declared in Open Graph tags', () => {
  const png=readFileSync(new URL('../public/share/facebook-cover.png',import.meta.url))
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  assert.equal(png.readUInt32BE(16),800);assert.equal(png.readUInt32BE(20),480)
})

test('Nginx hostname rule matches requested labels without a fixed domain list', () => {
  const conf=readFileSync(new URL('../deploy/nginx/facebook-share-title-http.conf',import.meta.url),'utf8')
  const pattern=conf.match(/"~([^"\n]+)"/)[1]
  const regex=new RegExp(pattern)
  const titles = {
    'spinvibe777.spin7m.com':'spinvibe777.spin7m',
    'vegasslots777us.com':'vegasslots777us',
    'pwa007.draft7bk.uk':'pwa007.draft7bk',
    'new-ad.example.net':'new-ad.example',
  }
  for(const [host,label] of Object.entries(titles)) assert.equal(regex.exec(host)?.groups.pwa_fb_label,label)
  for(const host of ['localhost','127.0.0.1','bad..example.com','host.test\"><script>','example.com/path']) assert.equal(regex.test(host),false)
  assert.ok(conf.includes('Online Slots at $pwa_fb_label| 700+ Real Money Slot Games'))
})
