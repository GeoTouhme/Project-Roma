'use strict';

const TYPES = ['inherit', 'none', 'alcohol', 'tobacco', 'unclassified'];
// Compatibility for existing records only. Explicit attributes take precedence;
// new/unknown categories fail closed until classified by staff.
const LEGACY_TYPES = {
  wine: 'alcohol', beer: 'alcohol', spirits: 'alcohol',
  'ready-to-drink-seltzers': 'alcohol', 'seltzers-and-more': 'alcohol',
  brandy: 'alcohol', gin: 'alcohol', liqueur: 'alcohol', rum: 'alcohol', tequila: 'alcohol',
  vodka: 'alcohol', whiskey: 'alcohol', 'brandy-and-cognac': 'alcohol', spiked: 'alcohol', 'hard-seltzer': 'alcohol',
  'tobacco-nicotine': 'tobacco', 'tobacco-and-nicotine': 'tobacco', tobacco: 'tobacco', nicotine: 'tobacco',
  water: 'none', 'sparkling-water': 'none', mixers: 'none', 'non-alcoholic-drinks': 'none',
  'snacks-food': 'none', 'health-wellness': 'none', 'accessories-more': 'none',
};
function restrictionOf(product) {
  const own = product?.restrictionType;
  const category = product?.category;
  const inherited = category?.restrictionType;
  if (inherited && inherited !== 'inherit' && inherited !== 'unclassified' && !TYPES.includes(inherited)) return 'unclassified';
  const parent = inherited && inherited !== 'inherit' && inherited !== 'unclassified'
    ? inherited : (LEGACY_TYPES[category?.slug] || 'unclassified');
  if (!own || own === 'inherit') return parent;
  if (!TYPES.includes(own) || own === 'unclassified') return 'unclassified';
  // Product overrides may add a restriction, never remove a known category restriction.
  if (parent === 'tobacco' || own === 'tobacco') return 'tobacco';
  if (parent === 'alcohol' || own === 'alcohol') return 'alcohol';
  return own;
}
function hasExplicitClassification(product) {
  if (product?.restrictionType === 'unclassified') return false;
  return ['none', 'alcohol', 'tobacco'].includes(product?.restrictionType)
    || ['none', 'alcohol', 'tobacco'].includes(product?.category?.restrictionType);
}
function restrictionsFor(products) {
  const types = new Set(products.map(restrictionOf));
  return { containsAlcohol: types.has('alcohol'), containsTobacco: types.has('tobacco'),
    hasUnclassifiedGoods: types.has('unclassified') };
}
module.exports = { TYPES, LEGACY_TYPES, restrictionOf, restrictionsFor, hasExplicitClassification };
