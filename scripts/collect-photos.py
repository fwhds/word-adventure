"""Collect credited Wikimedia photographs for the local English flashcards.

Run from project root: python scripts/collect-photos.py
Only openly licensed images are included; every downloaded image requires visual QA.
"""
from pathlib import Path
import concurrent.futures, urllib.request, urllib.parse, json, re, html, time

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'dist/assets/photos'
DEST.mkdir(parents=True, exist_ok=True)
AGENT = 'EnglishFlashcardPhotoCollector/1.0 (educational prototype; Wikimedia attribution)'
PLAN = {
 'panda':'Giant panda','elephant':'African bush elephant','tiger':'Tiger','lion':'Lion','bear':'Brown bear','snake':'Corn snake','chameleon':'Veiled chameleon','ostrich':'Common ostrich','koala':'Koala','kangaroo':'Red kangaroo','zebra':'Plains zebra','giraffe':'Giraffe','monkey':'Rhesus macaque','fox':'Red fox','rabbit':'European rabbit','lizard':'Green iguana','mouse':'House mouse','squirrel':'Eurasian red squirrel','hippo':'Hippopotamus','hedgehog':'European hedgehog','deer':'Red deer','wolf':'Wolf','gorilla':'Western gorilla','leopard':'Leopard','camel':'Bactrian camel','raccoon':'Raccoon','peacock':'Indian peafowl','parrot':'Scarlet macaw','swallow':'Barn swallow','eagle':'Bald eagle','owl':'Barn owl','crow':'Carrion crow','flamingo':'Greater flamingo','bat':'Egyptian fruit bat','dog':'Golden Retriever','cat':'Cat','rooster':'Rooster','hen':'Chicken','cow':'Holstein Friesian cattle','horse':'Horse','donkey':'Donkey','duck':'Domestic duck','goose':'Domestic goose','sheep':'Sheep','goat':'Goat','pig':'Pig','ant':'Black garden ant','fly':'Housefly','butterfly':'Monarch butterfly','dragonfly':'Dragonfly','ladybird':'Coccinella septempunctata','spider':'Araneus diadematus','worm':'Earthworm','snail':'Cornu aspersum','bee':'Western honey bee','beetle':'Stag beetle','fish':'Clownfish','octopus':'Common octopus','starfish':'Common starfish','shark':'Great white shark','crab':'Cancer pagurus','whale':'Humpback whale','jellyfish':'Aurelia aurita','sea-lion':'California sea lion','seal':'Harbor seal','frog':'Common frog','dolphin':'Common bottlenose dolphin','crocodile':'Nile crocodile','alligator':'American alligator','tortoise':'Hermann\'s tortoise','turtle':'Green sea turtle','shrimp':'Caridean shrimp','seahorse':'Hippocampus kuda','penguin':'King penguin',
 'hand':'Hand','eye':'Human eye','ear':'Human ear','nose':'Human nose','hair':'Hair','foot':'Foot',
 'apple':'Apple','pear':'Pear','peach':'Peach','cherry':'Cherry','grape':'Grape','plum':'Plum','strawberry':'Strawberry','blueberry':'Blueberry','banana':'Banana','orange':'Orange (fruit)','lemon':'Lemon','grapefruit':'Grapefruit','pineapple':'Pineapple','mango':'Mango','watermelon':'Watermelon','kiwi':'Kiwifruit','coconut':'Coconut','dragon-fruit':'Pitaya','cabbage':'Cabbage','carrot':'Carrot','potato':'Potato','onion':'Onion','garlic':'Garlic','ginger':'Ginger','cucumber':'Cucumber','pumpkin':'Pumpkin','chili-pepper':'Chili pepper','corn':'Sweet corn','pea':'Pea','green-bean':'Green bean','broccoli':'Broccoli','cauliflower':'Cauliflower',
 't-shirt':'T-shirt','shirt':'Dress shirt','blouse':'Blouse','sweater':'Sweater','sweatshirt':'Sweatshirt','suit':'Suit','coat':'Coat','jacket':'Leather jacket','vest':'Waistcoat','pants':'Trousers','trousers':'Trousers','jeans':'Jeans','shorts':'Shorts','skirt':'Skirt','dress':'Dress','sweatpants':'Sweatpants','pajamas':'Pajamas','socks':'Sock','shoes':'Shoe','boots':'Boot','high-heels':'High-heeled shoe','sandals':'Sandal','slippers':'Slipper','hat':'Hat','cap':'Baseball cap','scarf':'Scarf','gloves':'Glove','belt':'Belt (clothing)','tie':'Necktie','raincoat':'Raincoat','windbreaker':'Windbreaker','polo-shirt':'Polo shirt',
 'schoolbag':'Backpack','pen':'Fountain pen','ballpoint-pen':'Ballpoint pen','marker':'Marker pen','pencil':'Pencil','eraser':'Eraser','pencil-sharpener':'Pencil sharpener','notebook':'Notebook','exercise-book':'Exercise book','notepad':'Notepad','scissors':'Scissors','glue':'Glue stick','tape':'Adhesive tape','stapler':'Stapler','staples':'Staple (fastener)','ruler':'Ruler','compass':'Compass (drawing tool)','pencil-box':'Pencil case','bookshelf':'Bookcase','paper-clip':'Paper clip','highlighter':'Highlighter',
 'basketball':'Basketball (ball)','football':'Football (ball)','tennis':'Tennis','volleyball':'Volleyball (ball)','table-tennis':'Table tennis','jog':'Jogging','running':'Running','jumping':'Long jump','throwing':'Shot put','marathon':'Marathon','weightlifting':'Olympic weightlifting','swimming':'Swimming (sport)','surfing':'Surfing','surfboard':'Surfboard','diving':'Scuba diving','rowing':'Rowing (sport)','yoga':'Yoga as exercise','boxing':'Boxing','cycling':'Cycling',
 'sunny':'Daytime','rainy':'Rain','cloudy':'Cumulus cloud','snowy':'Snow','windy':'Wind','foggy':'Fog','storm':'Thunderstorm','hail':'Hail','typhoon':'Typhoon','drought':'Drought','frost':'Frost'
}

def fetch(url, binary=False):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':AGENT}), timeout=35) as res:
                data = res.read()
            return data if binary else json.loads(data)
        except Exception:
            if attempt == 2: raise
            time.sleep(1 + attempt)

def clean(s): return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]*>', '', str(s)))).strip()

def summary(pair):
    word, title = pair
    try:
        doc = fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ','_')))
        thumb = doc.get('thumbnail',{}).get('source','')
        match = re.search(r'/commons/thumb/[^/]+/[^/]+/([^/]+)/', thumb)
        if not match: return word, None, 'No Commons thumbnail'
        filename = urllib.parse.unquote(match.group(1))
        if not re.search(r'\.(jpe?g|png|webp)$',filename,re.I): return word,None,'Non-photographic format: '+filename
        return word, filename, None
    except Exception as e: return word,None,str(e)

def metadata(names):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo','iiprop':'extmetadata|url','titles':'|'.join('File:'+n for n in names),'iiurlwidth':'512'})
    doc = fetch(url)
    out = {}
    for page in doc.get('query',{}).get('pages',{}).values():
        if page.get('imageinfo'): out[page['title'].removeprefix('File:').replace('_',' ')] = page['imageinfo'][0]
    return out

def download(pair):
    word, info = pair
    try:
        meta = info.get('extmetadata',{})
        license = clean(meta.get('LicenseShortName',{}).get('value',''))
        if not license or not re.search(r'^(CC|Public domain)',license,re.I): return word,None,'License not included: '+license
        url = info.get('thumburl') or info['url']
        ext = '.png' if '.png' in url.lower() else '.jpg'
        data = fetch(url, True)
        if len(data)<300: raise ValueError('Image too small')
        path=DEST/(word+ext)
        path.write_bytes(data)
        row={'src':'assets/photos/'+path.name,'credit':clean(meta.get('Artist',{}).get('value','Wikimedia Commons contributor')),'source':info['descriptionurl'],'license':license,'licenseUrl':meta.get('LicenseUrl',{}).get('value',''),'description':clean(meta.get('ImageDescription',{}).get('value',''))}
        return word,row,None
    except Exception as e: return word,None,str(e)

def main():
    cache_path = DEST/'collection-metadata.json'
    cache=json.loads(cache_path.read_text('utf-8')) if cache_path.exists() else {'photos':{},'missing':{}}
    core_path=DEST/'core-ready.json'
    if core_path.exists():
        core=json.loads(core_path.read_text('utf-8')); core.pop('sunny',None)
        cache['photos'].update(core)
    pending={w:t for w,t in PLAN.items() if w not in cache['photos']}
    summaries={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for word,name,error in ex.map(summary,pending.items()):
            if name: summaries[word]=name
            else: cache['missing'][word]=error
    print('Commons thumbnails:',len(summaries),flush=True)
    (DEST/'summary-cache.json').write_text(json.dumps(summaries,ensure_ascii=False,indent=2),'utf-8')
    names=list(set(summaries.values())); metas={}
    for start in range(0,len(names),10):
        try: metas.update(metadata(names[start:start+10]))
        except Exception as e: print('Metadata batch failed:',start,str(e),flush=True)
    tasks=[]
    for word,name in summaries.items():
        info=metas.get(name.replace('_',' '))
        if info: tasks.append((word,info))
        else: cache['missing'][word]='Commons metadata not found'
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        for word,row,error in ex.map(download,tasks):
            if row:
                cache['photos'][word]=row; cache['missing'].pop(word,None)
            else: cache['missing'][word]=error
            if len(cache['photos'])%20==0: print('Downloaded:',len(cache['photos']),flush=True)
    cache_path.write_text(json.dumps(cache,ensure_ascii=False,indent=2),'utf-8')
    # This metadata output is reviewed before publication as WORD_PHOTOS.
    (ROOT/'dist/photos.js').write_text('const WORD_PHOTOS = '+json.dumps(cache['photos'],ensure_ascii=False,indent=2)+';\n','utf-8')
    print('Total downloaded:',len(cache['photos']),'missing:',len(cache['missing']),flush=True)

if __name__=='__main__': main()
