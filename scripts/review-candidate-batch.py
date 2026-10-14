"""Create review-only contact sheets for concrete-word replacement candidates."""
import importlib.util,json,sys
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'dist/assets/photos'
spec=importlib.util.spec_from_file_location('batch',ROOT/'scripts/photo-candidate-batch.py')
batch=importlib.util.module_from_spec(spec);spec.loader.exec_module(batch)
rows=[]
labels=list(batch.PLAN)+['fruit-peach','fruit-ginger','fruit-coconut']
prefix='candidate-batch'
if '--supplemental' in sys.argv:
    labels=[p.stem for p in (DEST/'candidates').glob('*.json') if p.stem not in labels and not p.stem.startswith('body-')]
    prefix='candidate-supplemental'
for label in labels:
    p=DEST/'candidates'/f'{label}.json'
    if p.exists():
        for index,row in enumerate(json.loads(p.read_text('utf-8')),1):
            if row.get('asset'):rows.append((label,index,row['asset']))
qa=DEST/'qa';qa.mkdir(exist_ok=True)
for start in range(0,len(rows),30):
    sheet=Image.new('RGB',(1200,5*200),'white');draw=ImageDraw.Draw(sheet)
    for i,(label,index,row) in enumerate(rows[start:start+30]):
        im=Image.open(ROOT/'dist'/row['src']).convert('RGB')
        thumb=ImageOps.contain(im,(190,165));x=(i%6)*200+(190-thumb.width)//2;y=(i//6)*200
        sheet.paste(thumb,(x,y));draw.text(((i%6)*200+4,y+171),label+' #'+str(index),fill='black')
    sheet.save(qa/f'{prefix}-{start//30+1}.jpg',quality=90)
print('Candidates:',len(rows),'sheets:',(len(rows)+29)//30)
