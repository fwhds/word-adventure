"""Publish only manually reviewed photographs and build a full attribution document."""
import json, re
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'dist/assets/photos'
REJECTED={
 'rooster':'照片同时出现公鸡和母鸡，无法让孩子明确辨认。',
 'hen':'照片同时出现公鸡和母鸡，无法让孩子明确辨认。',
 'hair':'候选是毛发解剖图，非真实外观照片。',
 'peach':'候选是植物学插图，非真实照片。',
 'coconut':'候选是植物学插图，非真实照片。',
 'ginger':'候选是植物学插图，非真实照片。',
 'coat':'候选是历史人物画作，非真实照片。',
 'pajamas':'候选是历史人物画作，非真实照片。',
 'skirt':'候选外观不够明确，暂不用于儿童识图。',
 'exercise-book':'候选是课堂场景，无法明确识别练习本。',
 'notepad':'与笔记本相同的照片不能说明便签本区别。',
}

def main():
    data=json.loads((DEST/'collection-metadata.json').read_text('utf-8'))
    core=json.loads((DEST/'core-ready.json').read_text('utf-8'))
    for word,row in core.items():
        data['photos'].setdefault(word,row)
    data['photos'].setdefault('sunny',json.loads((DEST/'sunny-ready.json').read_text('utf-8')))
    for word,reason in REJECTED.items():
        if data['photos'].get(word,{}).get('caption'):
            continue  # A newly selected, individually reviewed replacement exists.
        data['photos'].pop(word,None); data['missing'][word]=reason
    for word,row in data['photos'].items():
        data['missing'].pop(word,None)
        # Very long Artist blocks include camera/reuse instructions; preserve the
        # actual author's opening name while keeping the full source page link.
        credit=row['credit']
        if len(credit)>220:
            row['credit']=credit.split('Copyright')[0].split('Camera')[0][:220].strip()
        row['verified']=True
        if word in ('pants','trousers'): row['note']='pants / trousers 在本词库中是同义词，共用真实裤子照片。'
        if word=='typhoon': row['note']='台风卫星照片。'
        if word=='schoolbag' and not row.get('caption'): row['note']='背包实物照片；当前是背包形态示例。'
        if word=='cycling': row['credit']='Roman Bonnefoy (Romanceor)'
        if word=='typhoon': row['credit']='Japan Meteorological Agency（日本气象厅）'
    (DEST/'collection-metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf-8')
    (ROOT/'dist/photos.js').write_text('const WORD_PHOTOS = '+json.dumps(data['photos'],ensure_ascii=False,indent=2)+';\n','utf-8')
    text=(ROOT/'dist/vocab.js').read_text('utf-8')
    groups=re.findall(r"\['([^']+)'[^`]+`([^`]+)`",text)
    cats={line.split('|')[0].lower().replace(' ','-'):cat for cat,body in groups for line in body.strip().splitlines()}
    counts=Counter(cats.get(w,'other') for w in data['photos'])
    lines=['# 真实照片来源与授权 / Photo credits','',
           f'当前词库 257 个词条，其中 **{len(data["photos"])} 个词条**配有经过肉眼核对的真实照片。',
           '照片从 Wikimedia Commons 下载为本地缩略图，网页运行不依赖远程图片链接。每个资产的作者、原始来源页及许可证列在下表；作者权益和许可属于各自权利人。',
           '采用明确标记为 CC BY、CC BY-SA、CC0 或 Public domain 的文件；未采用授权只有 GFDL 1.2 的候选，以避免漏掉其额外分发义务。照片许可适用于照片本身，不会自动改变网站代码许可。',
           '素材保持下载时的照片内容，展示时可由界面按容器裁切；未把生成图、插画、解剖示意图当成真实照片。',
           '', '## 覆盖情况', '', '| 分类 | 有照片的词条数 |','|---|---:|']
    labels={'animals':'动物','body':'身体','food':'果蔬','clothes':'衣物','school':'文具','sports':'运动','weather':'天气'}
    lines += [f'| {labels.get(c,c)} | {n} |' for c,n in counts.items()]
    lines += ['', '数字保留数字；恐龙没有现生真实照片，若使用模型实拍则明确写模型。身体部位采用适合儿童的实拍局部，或真人实拍加定位圈；胸部、大腿等衣服覆盖位置写明覆盖情况。温度、湿度等抽象词继续用示意或文字，未冒充专属照片。其余未覆盖词主要因为未取得明确的适用许可、接口限流，或候选不适合儿童识图。未覆盖时前端应明确回退到示意图。',
              '同一张真人照片可以用于不同身体部位，但每个词都必须用定位圈与短标签明确目标。markers 的 x/y 为原图左上角百分比，width/height 是本地图片实际尺寸，渲染时应保持同一 viewBox，避免裁切导致标记移位。',
              'pants 与 trousers 在原词库中是同义词，因此共用裤子照片。typhoon 使用真实卫星照片。公鸡/母鸡混合照片已经排除。',
              '', '## 每项出处 / Individual attribution', '', '| 词条 | 作者 / Author | 许可证 / License | 来源 / Source |', '|---|---|---|---|']
    for word,row in sorted(data['photos'].items()):
        credit=row['credit'].replace('|','/').replace('\n',' ')
        lic=f'[{row["license"]}]({row["licenseUrl"]})' if row.get('licenseUrl') else row['license']
        lines.append(f'| {word} | {credit} | {lic} | [Wikimedia Commons]({row["source"]}) |')
    lines += ['', '## 历史候选未采用原因（后续可由新的实拍替换）', '', '| 词条 | 原因 |', '|---|---|']
    lines += [f'| {w} | {r} |' for w,r in sorted(REJECTED.items())]
    lines += ['', '## 复查与再采集', '', '`python scripts/collect-photos.py` 采集候选；`python scripts/review-photos.py` 生成联系表；逐张人工核对之后，`python scripts/finalize-reviewed-photos.py` 发布人工确认的名单。更新候选后必须重新检查，不能只凭文章标题认定图片正确。',
              '', 'Source images are credited per file above. These are locally cached Wikimedia thumbnails, used according to each file\'s listed license. Candidate drawings, ambiguous scenes, and unsuitable anatomy illustrations were excluded after visual review.']
    (ROOT/'PHOTO_CREDITS.md').write_text('\n'.join(lines)+'\n','utf-8')
    print('Verified:',len(data['photos']),dict(counts))

if __name__=='__main__': main()
