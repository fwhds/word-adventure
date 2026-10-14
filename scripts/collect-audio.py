"""Download exact-word English pronunciations with individual Wikimedia attribution.

Uses existing Wikimedia recordings, not TTS. Missing words remain missing so the
application can use system speech synthesis without inventing an audio asset.
"""
import concurrent.futures, html, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'dist/assets/audio'
DEST.mkdir(parents=True,exist_ok=True)
AGENT='EnglishFlashcardAudioCollector/1.0 (educational prototype; credited audio)'
CORE=['panda','elephant','tiger','cat','dog','apple','banana','pencil','sunny','rabbit','carrot','hand','basketball','schoolbag','fish']

def clean(s): return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>','',str(s)))).strip()

def fetch(url,binary=False):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':AGENT}),timeout=25) as res:
                b=res.read()
            return b if binary else json.loads(b)
        except Exception:
            if attempt==2: raise
            time.sleep(2+attempt)

def query(batch,accent):
    titles=['File:En-'+accent+'-'+word+'.ogg' for word in batch]
    url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','prop':'imageinfo|videoinfo','iiprop':'url|extmetadata','viprop':'url|derivatives','titles':'|'.join(titles)})
    doc=fetch(url)
    found={}
    for p in doc.get('query',{}).get('pages',{}).values():
        title=p.get('title','')
        match=re.fullmatch(r'File:En-'+accent+r'-(.+)\.ogg',title,re.I)
        if not match or not p.get('imageinfo'): continue
        word=match.group(1).replace('_',' ').lower()
        if word not in batch: continue
        info=p['imageinfo'][0]
        for video in p.get('videoinfo',[]):
            for derivative in video.get('derivatives',[]):
                if derivative.get('type')=='audio/mpeg':
                    info['mp3']=derivative['src']
        found[word]=info
    return found

def download(task):
    word,accent,info=task
    try:
        meta=info.get('extmetadata',{})
        license=clean(meta.get('LicenseShortName',{}).get('value',''))
        if not re.match(r'^(CC BY(?:-SA)?(?: \d|$)|CC0$|Public domain$)',license): return word,accent,None,'License not adopted: '+license
        url=info.get('mp3',info['url'])
        extension='.mp3' if 'mp3' in info else '.ogg'
        data=fetch(url,True)
        if extension=='.ogg' and data[:4]!=b'OggS': return word,accent,None,'Not an Ogg file'
        if extension=='.mp3' and not (data[:3]==b'ID3' or data[:2] in (b'\xff\xfb',b'\xff\xf3',b'\xff\xf2')): return word,accent,None,'Not an MP3 file'
        id=word.replace(' ','-')
        filename=id+'-'+accent+extension
        (DEST/filename).write_bytes(data)
        row={'src':'assets/audio/'+filename,'credit':clean(meta.get('Artist',{}).get('value','Wikimedia contributor')),'license':license,'licenseUrl':meta.get('LicenseUrl',{}).get('value',''),'source':info['descriptionurl'],'description':clean(meta.get('ImageDescription',{}).get('value',''))}
        return word,accent,row,None
    except Exception as e: return word,accent,None,str(e)

def publish(data):
    (DEST/'collection-metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf-8')
    (ROOT/'dist/audio.js').write_text('const WORD_AUDIO = '+json.dumps(data['audio'],ensure_ascii=False,indent=2)+';\n','utf-8')

def main():
    source=(ROOT/'dist/vocab.js').read_text('utf-8')
    words=[line.split('|')[0].strip().lower() for line in source.splitlines() if '|' in line and not line.lstrip().startswith(('const','return'))]
    words=[w for w in words if re.fullmatch(r'[a-z -]+',w)]
    words=CORE+[w for w in words if w not in CORE]
    cache=DEST/'collection-metadata.json'
    data=json.loads(cache.read_text('utf-8')) if cache.exists() else {'audio':{},'missing':{}}
    for accent in ([] if '--finalize' in sys.argv else ['us','uk']):
        pending=[w for w in words if accent not in data['audio'].get(w.replace(' ','-'),{})]
        for start in range(0,len(pending),15):
            batch=pending[start:start+15]
            try: infos=query(batch,accent)
            except Exception as e:
                print('Metadata failure:',accent,start,str(e),flush=True); continue
            for w in batch:
                if w not in infos: data['missing'][w.replace(' ','-')+'-'+accent]='Exact named recording not available'
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
                for word,acc,row,error in ex.map(download,[(w,accent,inf) for w,inf in infos.items()]):
                    id=word.replace(' ','-')
                    if row:
                        data['audio'].setdefault(id,{})[acc]=row
                        data['missing'].pop(id+'-'+acc,None)
                    else: data['missing'][id+'-'+acc]=error
            publish(data)
            print('Published:',len(data['audio']),'words;',sum(len(v) for v in data['audio'].values()),'recordings;',accent,start,flush=True)
    lines=['# 英文原声录音出处 / Pronunciation audio credits','',f'目前收录 **{len(data["audio"])} 个词条、{sum(len(v) for v in data["audio"].values())} 段原声录音**。',
        '所有录音来自 Wikimedia Commons 的单词发音文件，按原文件明确标记的 CC BY、CC BY-SA、CC0 或 Public domain 许可本地保存。没有使用商业 TTS，也没有把其他单词的录音配到本词条。',
        '文件名中的 En-us / En-uk 用于区分原来源标记的美式 / 英式发音；原录音的音色和音量可能不同。未覆盖的词条应回退到设备英文语音或明确提示暂无示范，不应静默播放其他词。',
        '下载优先使用 Wikimedia 官方提供的 MP3 转码；没有 MP3 时保存原始 Ogg 文件。内容来自同一个原始单词录音，未拼接单词。播放器可提供正常/慢速播放。每个资产的原始来源、作者及许可证如下。',
        '', '| 词条 | 口音 | 作者 | 许可证 | 来源 |', '|---|---|---|---|---|']
    for word,accents in sorted(data['audio'].items()):
        for accent,row in sorted(accents.items()):
            credit=row['credit'].replace('|','/'); license=row['license']
            if row.get('licenseUrl'): license=f'[{license}]({row["licenseUrl"]})'
            lines.append(f'| {word} | {accent.upper()} | {credit} | {license} | [Wikimedia Commons]({row["source"]}) |')
    lines+=['','## 核验与更新','',
        '采集脚本仅匹配本词库中完整单词对应的 Commons 文件名，并要求授权元数据和有效 Ogg/MP3 文件头。实施者应在播放器中试听代表词，特别是多词词组与数字；文件名/出处匹配不等于专业口音质量评估。',
        '`python scripts/collect-audio.py` 可重新采集；已成功的录音从本地缓存复用。网络限流、未找到或不满足许可筛选的词不强行补音。',
        '', 'These are original human pronunciation recordings from Wikimedia Commons, cached locally under their individually listed licenses. Exact file-title matching and Ogg/MP3 headers were verified. They are not paid text-to-speech outputs.']
    (ROOT/'AUDIO_CREDITS.md').write_text('\n'.join(lines)+'\n','utf-8')
    print('DONE:',len(data['audio']),'words',sum(len(v) for v in data['audio'].values()),'recordings',flush=True)

if __name__=='__main__': main()
