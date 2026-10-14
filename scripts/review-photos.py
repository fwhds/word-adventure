"""Create labeled contact sheets for manual verification; outputs stay under assets/photos/qa."""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root=Path(__file__).resolve().parents[1]
assets=root/'dist/assets/photos'
metadata=json.loads((assets/'collection-metadata.json').read_text('utf-8'))
rows=list(metadata['photos'].items())
qa=assets/'qa'
qa.mkdir(exist_ok=True)
for start in range(0,len(rows),35):
    sheet=Image.new('RGB',(1400,5*180),'white')
    draw=ImageDraw.Draw(sheet)
    for i,(word,info) in enumerate(rows[start:start+35]):
        photo=Image.open(root/'dist'/info['src']).convert('RGB')
        thumb=ImageOps.contain(photo,(190,145))
        x=(i%7)*200; y=(i//7)*180
        sheet.paste(thumb,(x+(190-thumb.width)//2,y))
        draw.text((x+5,y+149),word,fill='black')
    sheet.save(qa/f'contact-{start//35+1}.jpg',quality=88)
print('Contact sheets:',(len(rows)+34)//35)
