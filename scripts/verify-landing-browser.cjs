// Run with playwright-cli run-code --filename scripts/verify-landing-browser.cjs.
// Requires preview:blank on 4011 and preview:landing on 4012; APIs are mocked.
async (page) => {
  const browser = page.context().browser();
  const results = [];
  const android = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/123.0 Mobile Safari/537.36';
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';
  async function scenario(name, {ua, port=4011, facebook=false, shell=false, failure=false}) {
    const context = await browser.newContext({userAgent: ua, serviceWorkers: 'block', viewport: {width:390,height:844}, isMobile:true});
    const tab = await context.newPage();
    const errors = [];
    const events = [];
    tab.on('pageerror', e => errors.push(e.message));
    let release;
    const detailReady = new Promise(r => release = r);
    await context.route('**/api/pwa_h5_detail', async route => {
      await detailReady;
      await route.fulfill({status: failure ? 500 : 200, contentType:'application/json', body: JSON.stringify({code:200,data:{id:7,pwa_url_id:9,package_mode:'pwa_first',pwa_name:'Test App',h5_url:'https://h5.example.test/play?campaign=target',facebook_pixels:[],download_reward_amount:'27'}})});
    });
    await context.route('**/api/web_pwa_statistics', async route => {
      const payload = route.request().postDataJSON(); events.push(...payload.events);
      await route.fulfill({contentType:'application/json',body:JSON.stringify({code:200,data:{results:payload.events.map(e=>({event_id:e.event_id,status:'accepted'}))}})});
    });
    await context.route('https://h5.example.test/**', route => route.fulfill({contentType:'text/html',body:'<p>H5 mock</p>'}));
    const source = `http://127.0.0.1:${port}/?campaign=entry${shell?'&pwa_launch=1':''}`;
    await tab.goto(source, {waitUntil:facebook ? 'commit' : 'domcontentloaded'});
    if (port===4011 && !shell && !facebook) {
      const paint = await tab.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor, text:document.querySelector('#app').innerText,loader:document.querySelector('#identity-bootstrap-loading') ? getComputedStyle(document.querySelector('#identity-bootstrap-loading')).display : 'none'}));
      if (paint.bg !== 'rgb(255, 255, 255)' || paint.loader !== 'none') throw Error(name+' initial paint '+JSON.stringify(paint));
      if (!facebook && paint.text) throw Error(name+' visible content before detail: '+paint.text);
    }
    if (name === 'desktop blank') await tab.screenshot({path:'output/blank-before-config.png'});
    release();
    if (facebook && port === 4012) {
      if (ua.includes('iPhone')) {
        await tab.getByText('Test App', {exact:true}).first().waitFor({timeout:5000});
        if (await tab.locator('.pwa-open-browser-guide').count()) throw Error('legacy iOS unexpectedly gained a gate');
      } else {
        await tab.locator('.pwa-open-browser-guide').first().waitFor({timeout:5000});
      }
      if (await tab.locator('.blank-browser-guide').count()) throw Error('gold guide leaked into original interface');
      if (tab.url() !== source) throw Error('original Facebook entry redirected');
    } else if (facebook) {
      await tab.getByRole('dialog').waitFor();
      const text = await tab.getByRole('dialog').innerText();
      if (!text.includes('Open in Browser')) throw Error(name+' missing gold guide');
      await tab.getByText('$27', {exact:true}).waitFor();
      if (await tab.locator('.blank-browser-guide').evaluate(el=>getComputedStyle(el).backgroundColor) !== 'rgb(0, 0, 0)') throw Error('nonblack backdrop');
      if (await tab.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).count()) throw Error('closable guide');
      await tab.waitForTimeout(350);
      await tab.screenshot({path:ua.includes('iPhone')?'output/facebook-ios.png':'output/facebook-android.png'});
      if (!tab.url().startsWith(source)) throw Error(name+' navigated inside Facebook');
      if (ua.includes('iPhone') && await tab.getByRole('button',{name:'Open Safari',exact:true}).count()) throw Error('fake Safari launch button');
    } else if (shell) {
      await tab.locator('iframe').waitFor();
      if (await tab.locator('.pwa-blank-entry').count()) throw Error('shell has blank class');
    } else if (failure) {
      await tab.getByRole('alert').waitFor();
      if (tab.url() !== source) throw Error('failure redirected');
    } else if (port===4012) {
      await tab.getByText('Test App',{exact:true}).first().waitFor();
      if (tab.url() !== source) throw Error('landing redirected');
      await tab.screenshot({path:'output/original-landing.png'});
    } else {
      await tab.waitForURL('https://h5.example.test/**');
      const url = new URL(tab.url());
      if (url.searchParams.get('campaign')!=='target' || url.searchParams.get('pwa_id')!=='7' || url.searchParams.get('pwa_url_id')!=='9') throw Error('missing attribution '+url);
      if (ua.includes('iPhone') && url.searchParams.get('pwa_ios_h5_redirect')!=='1') throw Error('missing iOS marker');
    }
    if (errors.length) throw Error(name+': '+errors.join(';'));
    if (events.some(e=>e.event_name==='install_click')) throw Error('automatic install event');
    results.push({name,passed:true,events:events.map(e=>e.event_name)});
    await context.close();
  }
  for (const [name, options] of [
    ['desktop blank',{ua:'Mozilla/5.0 Windows Chrome/123'}],
    ['Android Chrome blank',{ua:android}],
    ['iOS Safari blank',{ua:ios}],
    ['Android Facebook no ad params',{ua:android+' FBAV/123',facebook:true}],
    ['iOS Facebook no ad params',{ua:ios+' FBIOS FBAN/FBIOS',facebook:true}],
    ['installed shell launch',{ua:android,shell:true}],
    ['interface version',{ua:android,port:4012}],
    ['original Android Facebook guide',{ua:android+' FBAV/123',facebook:true,port:4012}],
    ['original iOS Facebook guide',{ua:ios+' FBIOS FBAN/FBIOS',facebook:true,port:4012}],
    ['detail failure',{ua:android,failure:true}],
  ]) await scenario(name,options);
  return results;
}
