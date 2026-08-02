/**
 * Shop stock, rarity and re-roll checks.
 *
 *   npx tsx scripts/shop-check.ts
 */
import {
  SHOP_ITEMS, SHOP_STOCK_SIZE, rollShopStock, shopRarity, rerollCost, RARITY_STYLE,
  type ShopItem,
} from '../shared/types';

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nShop');

// --- stock is bounded and never repeats an item ---
{
  let maxSize = 0;
  let dupes = 0;
  for (let i = 0; i < 200; i++) {
    const stock = rollShopStock(6, 7);
    maxSize = Math.max(maxSize, stock.length);
    if (new Set(stock.map((s) => s.id)).size !== stock.length) dupes++;
  }
  check('stock respects the size cap', maxSize <= SHOP_STOCK_SIZE, `max ${maxSize}`);
  check('stock never repeats an item', dupes === 0, `${dupes} rolls had duplicates`);
}

// --- stock never offers something the party cannot use ---
{
  let overLevel = 0;
  let overFloor = 0;
  for (let floor = 1; floor <= 10; floor++) {
    for (let lvl = 1; lvl <= 10; lvl++) {
      for (let i = 0; i < 12; i++) {
        for (const item of rollShopStock(floor, lvl)) {
          if (item.levelRequirement && item.levelRequirement > lvl) overLevel++;
          if (item.floorRequirement && item.floorRequirement > floor) overFloor++;
        }
      }
    }
  }
  check('no item above the party level', overLevel === 0, `${overLevel} offences`);
  check('no item above the floor', overFloor === 0, `${overFloor} offences`);
}

// --- a healing option is always available ---
{
  let missing = 0;
  for (let lvl = 1; lvl <= 10; lvl++) {
    for (let i = 0; i < 60; i++) {
      const stock = rollShopStock(5, lvl);
      if (!stock.some((s) => s.type === 'consumable')) missing++;
    }
  }
  check('always at least one consumable', missing === 0, `${missing} stocks had none`);
}

// --- stock actually varies between visits ---
{
  const signatures = new Set<string>();
  for (let i = 0; i < 60; i++) {
    signatures.add(rollShopStock(8, 9).map((s) => s.id).join(','));
  }
  check('stock varies between visits', signatures.size > 10, `${signatures.size} distinct stocks in 60 rolls`);
}

// --- stock is sorted cheapest first ---
{
  let unsorted = 0;
  for (let i = 0; i < 100; i++) {
    const stock = rollShopStock(8, 9);
    for (let j = 1; j < stock.length; j++) if (stock[j].cost < stock[j - 1].cost) unsorted++;
  }
  check('stock is sorted by price', unsorted === 0, `${unsorted} out-of-order pairs`);
}

// --- rarity covers every item and escalates with tier ---
{
  const seen = new Set<string>();
  for (const item of SHOP_ITEMS) seen.add(shopRarity(item as ShopItem));
  check('every rarity tier is reachable', seen.size === 5, `${[...seen].join(', ')}`);
  check('every rarity has a style', [...seen].every((r) => RARITY_STYLE[r as keyof typeof RARITY_STYLE]));

  const cheap = SHOP_ITEMS.find((i) => i.id === 'small_health') as ShopItem;
  const dear = SHOP_ITEMS.find((i) => i.id === 'soul_blade') as ShopItem;
  check('cheap starter reads as common', shopRarity(cheap) === 'common');
  check('endgame item reads as legendary', shopRarity(dear) === 'legendary');
}

// --- re-roll cost escalates so it cannot be spammed ---
{
  const costs = [0, 1, 2, 3].map(rerollCost);
  check('re-roll cost escalates', costs.every((c, i) => i === 0 || c > costs[i - 1]), costs.join(' → '));
  check('first re-roll is affordable', costs[0] <= 50, String(costs[0]));
}

console.log(failures === 0 ? '\nAll shop checks passed.\n' : `\n${failures} shop check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
