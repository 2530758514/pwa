// Component QA harness: run Vite on 4013 and serve tests/fixtures/blankBrowserGuide.html.
async (page) => {
  const browser = page.context().browser();
  const results = [];
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1 FBIOS';
  for (const [name, width, height, failImages] of [
    ['ios-gold',390,844,false],['narrow-gold',320,568,false],['landscape-gold',844,390,false],['missing-images',390,844,true],
  ]) {
    const context = await browser.newContext({userAgent:ios,viewport:{width,height},isMobile:true,serviceWorkers:'block'});
    if (failImages) await context.route('**/*.webp', route=>route.abort());
    const tab = await context.newPage();
    const errors=[]; tab.on('pageerror',e=>errors.push(e.message));
    await tab.goto('http://127.0.0.1:4013/tests/fixtures/blankBrowserGuide.html', {waitUntil:'commit'});
    const dialog=tab.getByRole('dialog'); await dialog.waitFor();
    if(await dialog.getByRole('button').count() !== 1) throw Error(name+' unexpected controls');
    if(await dialog.locator('.blank-browser-guide__hero').count()) throw Error('unconfirmed reward shown');
    await tab.evaluate(()=>{window.guideProps.amount='999';});
    if(await dialog.locator('.blank-browser-guide__hero').count()) throw Error('stale amount shown');
    await tab.evaluate(()=>{window.guideProps.amount='27';window.guideProps.confirmed=true;});
    await tab.getByText('$27',{exact:true}).waitFor();
    const backdrop=await tab.locator('.blank-browser-guide').evaluate(el=>({background:getComputedStyle(el).backgroundColor,filter:getComputedStyle(el).backdropFilter}));
    if(backdrop.background!=='rgb(0, 0, 0)'||backdrop.filter!=='none') throw Error('not pure black');
    await tab.screenshot({path:`output/${name}.png`});
    await tab.evaluate(()=>{window.guideProps.amount=0;}); await tab.getByText('$0',{exact:true}).waitFor();
    await tab.evaluate(()=>{window.guideProps.amount='123456789.12';}); await tab.getByText('$123,456,789.12',{exact:true}).waitFor();
    await tab.screenshot({path:`output/${name}-long.png`});
    const overflow=await tab.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow) throw Error(name+' horizontal overflow');
    await tab.evaluate(()=>{window.guideProps.amount='not-valid';});
    await tab.waitForTimeout(50);
    if(await dialog.locator('.blank-browser-guide__hero').count()) throw Error('invalid amount shown');
    await tab.evaluate(()=>{window.guideProps.amount='';});
    await tab.getByRole('button',{name:'Open in Browser',exact:true}).click();
    await dialog.waitFor();
    await tab.keyboard.press('Escape'); await dialog.waitFor();
    await tab.locator('.blank-browser-guide').click({position:{x:2,y:2}}); await dialog.waitFor();
    if(errors.length) throw Error(errors.join(';'));
    results.push({name,passed:true}); await context.close();
  }
  return results;
}
