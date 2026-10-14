"""Find explicitly licensed photographic candidates. Nothing is published automatically."""
import argparse, concurrent.futures, importlib.util, json, urllib.parse
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/collect-photos.py')
collector=importlib.util.module_from_spec(spec); spec.loader.exec_module(collector)
DEST=ROOT/'dist/assets/photos/candidates'
DEST.mkdir(exist_ok=True)

def search(query,limit=6):
    u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','generator':'search','gsrsearch':query+' filetype:bitmap','gsrnamespace':'6','gsrlimit':str(limit),'prop':'imageinfo','iiprop':'extmetadata|url','iiurlwidth':'480'})
    doc=collector.fetch(u)
    rows=[]
    for p in doc.get('query',{}).get('pages',{}).values():
        if not p.get('imageinfo'): continue
        info=p['imageinfo'][0]; meta=info.get('extmetadata',{})
        lic=collector.clean(meta.get('LicenseShortName',{}).get('value',''))
        if lic.startswith(('CC BY','CC0','Public domain')):
            rows.append({'title':p['title'],'info':info,'license':lic,'description':collector.clean(meta.get('ImageDescription',{}).get('value',''))})
    return rows

def download_batch(label,rows):
    output=[]
    for i,row in enumerate(rows):
        name=label+'-'+str(i+1)
        word,asset,error=collector.download((name,row['info']))
        if asset:
            row['asset']=asset; output.append(row)
        else: print('Failed:',name,error,flush=True)
    (DEST/(label+'.json')).write_text(json.dumps(output,ensure_ascii=False,indent=2),'utf-8')
    return output

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('label'); p.add_argument('query'); p.add_argument('--limit',type=int,default=6); p.add_argument('--download',action='store_true'); args=p.parse_args()
    rows=search(args.query,args.limit)
    if args.download: rows=download_batch(args.label,rows)
    else: (DEST/(args.label+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),'utf-8')
    print(json.dumps([(r['title'],r['license'],r['description'][:180],r.get('asset',{}).get('src')) for r in rows],ensure_ascii=True,indent=2))
