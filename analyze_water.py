import csv

with open(r'c:\Users\User\Desktop\Project-Roma\bal_port_ubereats_catalog.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

water = [r for r in rows if r['Aisle'] == 'Water']

# Better classification with refined keywords
for r in water:
    name = r['Item Name']
    nl = name.lower()
    
    # Determine correct category
    if any(k in nl for k in ['coconut water', 'coco water', 'coco watr', 'vita coco', 'c2o coconut',
                              'harmless smoothie', 'harnless h coco', 'harnless harvet coco',
                              'harmless organic coconut', 'harmless organic sparkling coconut',
                              'real coconut', 'organic coconut', 'vita coconut', 'vita cococ',
                              'vita 1  liter']):
        r['_new'] = 'Drinks'
    elif any(k in nl for k in ['liquid death tea']):
        r['_new'] = 'Drinks'
    elif any(k in nl for k in ['celsius', 'ghost blue', 'zipfizz', 'zippfizz', 
                                'liquid i.v', 'liquid iv', 'm>power']):
        r['_new'] = 'Energy & Sports Drinks'
    elif any(k in nl for k in ['fever tree', 'fevertree', 'fever-tree', 
                                'tonic water', 'club soda', 'schweppes', 'schwepps',
                                'canada dry', 'jaritoas mineragua']):
        r['_new'] = 'MIXERS'
    elif any(k in nl for k in ['spindrift', 'ocean bomb', 'oceanbomb']):
        r['_new'] = 'Juice'
    elif any(k in nl for k in ['sparkling ice', 'ice sparkling']):
        r['_new'] = 'Drinks'
    elif any(k in nl for k in ['bubly']):
        r['_new'] = 'Drinks'
    elif any(k in nl for k in ['la croix', 'lacroix']):
        r['_new'] = 'Drinks'
    elif any(k in nl for k in ['laredo refill']):
        r['_new'] = 'Grocery'
    elif any(k in nl for k in ['hawaii']) and 'hawaiian' not in nl:
        r['_new'] = 'Drinks'
    else:
        # These should remain Water - includes: Topo Chico, S. Pellegrino, Saratoga, 
        # Mountain Valley, Maison Perrier, Life Wtr, Eternal, etc.
        r['_new'] = 'Water'

# Print summary
from collections import Counter
changes = Counter()
stay = []
move = []

for r in water:
    if r['_new'] == 'Water':
        stay.append(r)
    else:
        move.append(r)
        changes[r['_new']] += 1

print(f"TOTAL items currently in 'Water': {len(water)}")
print(f"Items that SHOULD stay in Water:  {len(stay)}")
print(f"Items to MOVE to other categories: {len(move)}")
print()
print("MOVES NEEDED:")
print("=" * 90)

for cat in sorted(changes.keys()):
    items = [r for r in move if r['_new'] == cat]
    print(f"\n>>> Move to '{cat}' ({len(items)} items):")
    for r in items:
        print(f"    - {r['Item Name'][:70]}")

print()
print("=" * 90)
print("ITEMS STAYING IN WATER:")
print("=" * 90)
for r in stay:
    print(f"    - {r['Item Name'][:70]}")
