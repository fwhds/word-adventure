"""Bounded candidate collection for missing concrete terms, never auto-published."""
import concurrent.futures, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('candidates',ROOT/'scripts/photo-candidates.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
PLAN={
 'kangaroo':'kangaroo standing -drawing -painting -statue',
 'giraffe':'giraffe standing -drawing -painting -statue',
 'mouse':'house mouse -drawing -painting -illustration',
 'dinosaur':'dinosaur model museum -drawing -painting -skeleton',
 'rooster':'rooster single bird -painting -drawing',
 'hen':'hen chicken brown -painting -drawing',
 'butterfly':'butterfly on flower -painting -drawing',
 'beetle':'rhinoceros beetle -illustration -drawing',
 'tortoise':'giant tortoise -drawing -painting',
 'penguin':'gentoo penguin -drawing -painting',
 'peach':'peach fruit -painting -drawing -illustration -bloom',
 'coconut':'coconut fruit white background -drawing -illustration',
 'cabbage':'green cabbage vegetable -illustration -drawing',
 'garlic':'garlic bulbs -drawing -illustration',
 'ginger':'ginger rhizome -drawing -illustration',
 'green-bean':'green beans vegetable -drawing -illustration',
 'broccoli':'broccoli vegetable -drawing -illustration',
 'coat':'coat hanging -drawing -painting -cosplay',
 'skirt':'skirt hanging -drawing -painting -cosplay',
 'pajamas':'pajamas clothing -drawing -painting -nude',
 'sandals':'sandals shoe -drawing -painting -illustration',
 'slippers':'slippers footwear -drawing -painting',
 'hat':'straw hat isolated -drawing -painting',
 'polo-shirt':'polo shirt -drawing -painting',
 'eraser':'eraser stationery -drawing -illustration',
 'exercise-book':'exercise book notebook -drawing -illustration',
 'notepad':'sticky notes pad -drawing -illustration',
 'staples':'staples fastener -drawing -illustration',
 'ruler':'ruler stationery -drawing -illustration',
 'highlighter':'highlighter pens -drawing -illustration',
 'football':'football soccer ball -drawing -illustration',
 'running':'running runner athlete -painting -illustration',
 'jumping':'jumping child playground -painting -illustration',
 'marathon':'marathon runners race -painting -illustration',
 'weightlifting':'weightlifting athlete barbell -painting -illustration',
 'swimming':'swimming pool swimmer -painting -illustration',
 'surfing':'surfer surfing wave -painting -illustration',
 'diving':'scuba diving underwater -painting -illustration',
 'yoga':'yoga exercise pose -painting -illustration',
 'cloudy':'cloudy sky clouds -painting -illustration',
 'snowy':'snowfall snowy weather -painting -illustration',
 'windy':'windsock wind -painting -illustration',
 'storm':'thunderstorm lightning -painting -illustration',
 'schoolbag-new':'school bag backpack -drawing -illustration',
 'jacket-new':'jacket hanging -drawing -illustration -painting',
 'dress-new':'dress hanging -drawing -illustration -painting',
 'kiwi-new':'kiwifruit cut -drawing -illustration -painting',
 'marker-new':'marker pens stationery -drawing -illustration -painting',
}

def run(pair):
    label,query=pair
    output=module.DEST/(label+'.json')
    if output.exists():return label,'cached'
    try:
        rows=module.search(query,3)
        rows=module.download_batch(label,rows)
        return label,str(len(rows))
    except Exception as e:return label,str(e)

if __name__=='__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for label,result in pool.map(run,PLAN.items()):print(label,result,flush=True)
