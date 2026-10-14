"""Apply individually selected photo candidates after visual review.

Markers are percentages from original image top-left. Source pixels are retained;
the application must keep image and markers in the same aspect-ratio viewBox.
"""
import copy,json
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'dist/assets/photos'
# word: candidate label, 1-based index within saved candidate list, caption, marker
SELECTED={
 'head':('body-face',1,'头部实拍',None),
 'hair':('body-face',1,'定位圈标出头发',(48,12,'头发')),
 'eyebrow':('body-face',1,'定位圈标出眉毛',(39,42,'眉毛')),
 'nose':('body-face',1,'定位圈标出鼻子',(48,60,'鼻子')),
 'mouth':('body-face',1,'定位圈标出嘴巴',(49,72,'嘴巴')),
 'cheek':('body-face',1,'定位圈标出脸颊',(35,64,'脸颊')),
 'chin':('body-face',1,'定位圈标出下巴',(48,84,'下巴')),
 'neck':('body-face',1,'定位圈标出脖子',(48,93,'脖子')),
 'ear':('body-ear',3,'耳朵局部实拍',None),
 'shoulder':('body-joints',2,'定位圈标出肩膀的位置',(73,52,'肩膀')),
 'chest':('body-joints',2,'定位圈标出胸部的位置，衣服覆盖处',(51,70,'胸部')),
 'arm':('body-joints',2,'定位圈标出胳膊',(87,52,'胳膊')),
 'elbow':('body-joints',2,'定位圈标出肘部',(94,43,'肘部')),
 'waist':('body-standing',7,'定位圈标出腰部的位置，衣服覆盖处',(40,30,'腰部')),
 'hip':('body-sport',6,'定位圈标出髋部/臀部外侧，运动服覆盖处',(57,76,'髋部')),
 'leg':('body-standing',7,'定位圈标出腿部',(27,78,'腿部')),
 'knee':('body-standing',7,'定位圈标出膝盖',(27,63,'膝盖')),
 'thigh':('body-standing',7,'定位圈标出大腿的位置，短裤覆盖处',(33,45,'大腿')),
 'ankle':('body-standing',7,'定位圈标出脚踝',(24,89,'脚踝')),
 'foot':('body-foot',4,'脚部实拍',None),
 'toe':('body-foot',1,'定位圈标出一根脚趾',(51,36,'脚趾')),
 'heel':('body-foot',4,'定位圈标出脚后跟',(83,67,'脚后跟')),
 'finger':('existing', 'hand','定位圈标出一根手指',(61,25,'手指')),
 'shorts':('body-standing',7,'短裤实拍',None),
 'kangaroo':('kangaroo-real',2,'袋鼠实拍',None),
 'giraffe':('giraffe',2,'长颈鹿实拍',None),
 'mouse':('mouse',3,'老鼠实拍',None),
 'dinosaur':('dinosaur-real',3,'恐龙模型实拍；不是现生恐龙照片',None),
 'rooster':('rooster-full',1,'公鸡实拍',None),
 'hen':('hen',2,'母鸡头部实拍',None),
 'butterfly':('butterfly-real2',1,'蝴蝶实拍',None),
 'beetle':('beetle',1,'甲壳虫实拍',None),
 'tortoise':('tortoise',2,'陆龟实拍',None),
 'penguin':('penguin',1,'企鹅实拍',None),
 'peach':('fruit-peach',2,'桃子实拍',None),
 'coconut':('fruit-coconut',1,'椰子实拍',None),
 'cabbage':('cabbage-real',1,'卷心菜实拍',None),
 'garlic':('garlic-real',1,'大蒜实拍',None),
 'ginger':('ginger-real',3,'姜实拍',None),
 'green-bean':('green-bean-real',3,'四季豆实拍；不同品种的豆荚',None),
 'broccoli':('broccoli-real',3,'西兰花实拍',None),
 'coat':('coat-real',2,'外套实拍',None),
 'skirt':('skirt',1,'半身裙实拍',None),
 'pajamas':('pajamas-real',2,'睡衣套装实拍',None),
 'sandals':('sandals-real',3,'凉鞋实拍（带跟款）',None),
 'slippers':('slippers',1,'拖鞋实拍',None),
 'hat':('hat',1,'草帽实拍',None),
 'polo-shirt':('polo-shirt',3,'Polo衫实拍',None),
 'eraser':('eraser-real',2,'橡皮实拍',None),
 'exercise-book':('exercise-book',3,'练习本实拍',None),
 'notepad':('notepad-real',3,'便签本实拍',None),
 'staples':('staples',1,'订书钉实拍',None),
 'ruler':('ruler-real',1,'尺子实拍',None),
 'highlighter':('highlighter-real',3,'荧光笔实拍',None),
 'football':('football',2,'足球实拍',None),
 'running':('running-real',2,'跑步实拍',None),
 'jumping':('jumping-real',1,'跳跃动作实拍',None),
 'marathon':('marathon-real',1,'马拉松比赛实拍',None),
 'weightlifting':('weightlifting-lift',1,'举重动作实拍',None),
 'swimming':('swimming',1,'游泳练习实拍',None),
 'surfing':('surfing-real',1,'冲浪实拍',None),
 'diving':('diving-real',1,'潜水实拍',None),
 'yoga':('yoga-real',3,'瑜伽姿势实拍',None),
 'cloudy':('cloudy',2,'多云天气实拍',None),
 'snowy':('snowy',1,'下雪天气实拍',None),
 'windy':('windy-real',1,'风吹起风向袋的实拍',None),
 'storm':('storm-real',1,'暴风雨中的闪电实拍',None),
 'schoolbag':('schoolbag-new',1,'学生书包实拍',None),
 'jacket':('jacket-plain',3,'夹克实拍（牛仔夹克）',None),
 'marker':('marker-new',3,'马克笔实拍（白板笔）',None),
}

def main():
    data=json.loads((DEST/'collection-metadata.json').read_text('utf-8'))
    added=[]
    for word,(label,index,caption,marker) in SELECTED.items():
        if label=='existing': row=copy.deepcopy(data['photos'][index])
        else:
            candidates=json.loads((DEST/'candidates'/f'{label}.json').read_text('utf-8'))
            row=copy.deepcopy(candidates[index-1]['asset'])
        im=Image.open(ROOT/'dist'/row['src'])
        row.update({'width':im.width,'height':im.height,'caption':caption,'verified':True})
        if marker:
            x,y,text=marker
            row['markers']=[{'x':x,'y':y,'label':text}]
        else: row.pop('markers',None)
        data['photos'][word]=row; data['missing'].pop(word,None)
        added.append((word,row))
    # Existing photographs also receive dimensions for consistent SVG rendering.
    for row in data['photos'].values():
        if 'width' not in row:
            im=Image.open(ROOT/'dist'/row['src']); row.update(width=im.width,height=im.height)
    (DEST/'collection-metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),'utf-8')
    (ROOT/'dist/photos.js').write_text('const WORD_PHOTOS = '+json.dumps(data['photos'],ensure_ascii=False,indent=2)+';\n','utf-8')
    qa=DEST/'qa';qa.mkdir(exist_ok=True)
    # Contact-sheet rendering only; the actual licensed images are not modified.
    for start in range(0,len(added),12):
        sheet=Image.new('RGB',(1200,3*260),'white');draw=ImageDraw.Draw(sheet)
        for i,(word,row) in enumerate(added[start:start+12]):
            source=Image.open(ROOT/'dist'/row['src']).convert('RGB')
            thumb=ImageOps.contain(source,(280,225))
            left=(i%4)*300+(280-thumb.width)//2; top=(i//4)*260
            sheet.paste(thumb,(left,top))
            for marker in row.get('markers',[]):
                x=left+marker['x']*thumb.width/100;y=top+marker['y']*thumb.height/100
                draw.ellipse((x-7,y-7,x+7,y+7),outline='#ff2861',width=3)
            draw.text(((i%4)*300+8,top+230),word,fill='black')
        sheet.save(qa/f'augmentation-{start//12+1}.jpg',quality=90)
    print('Selected:',len(added),'total:',len(data['photos']))

if __name__=='__main__':main()
