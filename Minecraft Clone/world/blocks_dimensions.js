export function registerDimensionBlocks(tile, block) {
  const ids = {};
  function add(key, colors, pattern = 'grain', properties = {}, top) {
    const side = tile(colors, pattern);
    ids[key] = block(key, key.replaceAll('_', ' '), top ? [side, tile(top, 'rings'), side] : side, properties);
  }
  const glow = { glow: true };
  add('netherrack', ['#6e2429','#873136','#531e28','#a3443b'], 'cracked');
  add('nether_bricks', ['#36202b','#4b2834','#190f1c','#663540'], 'brick');
  add('soul_sand', ['#654b3c','#80634b','#382e2b','#967558'], 'cracked');
  add('glowstone', ['#bc7f35','#ffe69b','#785027','#ffce65'], 'ore', glow);
  add('magma', ['#492329','#ff8b20','#271d25','#ed4818'], 'cracked', glow);
  add('lava', ['#e34012','#ffcb38','#b72a0c','#ff7a15'], 'swirl', { liquid: true, solid: false, glow: true });
  add('nether_quartz_ore', ['#763039','#f2ded1','#56232b','#d2b5b0'], 'ore');
  add('basalt', ['#40414b','#60616a','#292c34','#777781'], 'bark', {}, ['#62616b','#40414b','#777781','#292c34']);
  add('crimson_nylium', ['#682636','#a63b50','#462738','#c74b5b'], 'speckle');
  add('warped_nylium', ['#256d6b','#379d91','#214b54','#51b7a0'], 'speckle');
  add('crimson_stem', ['#54283d','#8e3b55','#301f33','#c15b70'], 'bark', {}, ['#ba657d','#7e3d56','#d6858c','#45263e']);
  add('warped_stem', ['#28545c','#39857c','#253143','#50b0a1'], 'bark', {}, ['#55a99a','#326b70','#80c8ae','#253d50']);
  add('nether_wart_block', ['#8c192e','#b02a3e','#651a2b','#cc3e50'], 'speckle');
  add('warped_wart_block', ['#196a68','#248e7d','#164854','#3eab94'], 'speckle');
  add('shroomlight', ['#ea8c43','#ffcf7d','#b45430','#ffe49b'], 'ore', glow);
  add('obsidian', ['#211b35','#322443','#100f20','#493558'], 'cracked');
  add('nether_portal', ['#47136a','#b25ee9','#230e43','#8030b5'], 'swirl', { solid: false, glow: true });
  add('end_stone', ['#d6d49a','#e8e5b0','#afaf7c','#f4ecc4'], 'speckle');
  add('end_stone_bricks', ['#d6d49a','#e8e5b0','#9c9c6f','#f4ecc4'], 'brick');
  add('purpur_block', ['#a578a6','#be94bc','#805e88','#cba7c6'], 'panel');
  add('purpur_pillar', ['#a578a6','#be94bc','#805e88','#cba7c6'], 'stripes');
  add('chorus_plant', ['#50384f','#72516f','#342b3d','#98718e'], 'bark');
  add('chorus_flower', ['#a489a1','#d3bad0','#655167','#ecd6e7'], 'panel');
  add('end_rod', ['#e4d9bb','#fff7dd','#a99a89','#ffffff'], 'stripes', glow);
  add('end_crystal', ['#ac4a9b','#f8a6ec','#663b85','#ffe3fc'], 'cracked', glow);
  add('end_portal_frame', ['#476c61','#819b78','#263e3d','#c0b98c'], 'panel');
  add('end_portal', ['#080d20','#c2c6ee','#11162c','#634780'], 'stars', { solid: false, glow: true });
  add('asphalt', ['#30343b','#383c42','#282b30','#42454a']);
  add('asphalt_lane', ['#30343b','#f4ca42','#252a32','#eeece0'], 'lane');
  add('sidewalk', ['#a0a5a9','#b7bbbd','#737b80','#c8cbcb'], 'panel');
  add('curb', ['#a8acb0','#dadbd4','#646f78','#c6c9c9'], 'stripes');
  for (const [name, colors] of Object.entries({
    gray: ['#858b94','#969ba4','#676e78','#a5aab2'],
    white: ['#dce0dd','#ecede5','#bec5c6','#f4f4ed'],
    red: ['#9d5351','#b16960','#82454a','#bf7c6b'],
    blue: ['#50677e','#637f98','#3d5067','#7c95aa'],
  })) add(`concrete_${name}`, colors);
  add('glass_window', ['#152b46','#42627a','#0d1c30','#7398af'], 'window');
  add('lit_window', ['#edbd6d','#ffe7a1','#514235','#fff0bd'], 'window', glow);
  add('office_facade', ['#34475b','#708598','#182d45','#a4b1b8'], 'window');
  add('brick_facade', ['#9e5946','#bc795e','#513f3b','#d19173'], 'brick');
  add('steel_beam', ['#576775','#a6b4be','#313d4b','#dae0df'], 'stripes');
  add('metal_panel', ['#677581','#8c9ba4','#394651','#b3bcc0'], 'panel');
  add('rooftop_vent', ['#56616a','#99a3a9','#263039','#c0c5c4'], 'stripes');
  add('helipad', ['#3d574b','#e6dfa3','#293d37','#c9cdad'], 'helipad');
  for (const [name, colors] of Object.entries({
    cyan: ['#12485c','#63f7ff','#123040','#c5ffff'],
    pink: ['#5c214f','#ff63cc','#361b39','#ffd2f5'],
    green: ['#20513e','#75ff85','#17352d','#d0ffd3'],
    orange: ['#653624','#ffad49','#3d2723','#ffe4ae'],
  })) add(`neon_${name}`, colors, 'neon', glow);
  add('street_lamp', ['#dbcf9e','#fff1bc','#697177','#ffffff'], 'panel', glow);
  add('billboard', ['#23354e','#f0ad55','#132338','#57c6d8'], 'billboard');
  add('hedge', ['#305436','#52764a','#213b2e','#6b8c51'], 'speckle');
  add('city_portal', ['#0a4259','#6dffff','#062436','#21bad4'], 'swirl', { solid: false, glow: true });
  return ids;
}
