"""Generate source-resolution terrain, map and traceable sprite conversions."""
from pathlib import Path
import json, random, sys
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parents[1]
assets=root/'dist/assets'
source=Path(sys.argv[1]) if len(sys.argv)>1 else None
assets.mkdir(exist_ok=True)
def write(name,data):
    (assets/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

tile=16
palette={
 'lavender':('#b4a5d7','#b9abdb','#ada0d1','#c2b3e2','#9e90c6','#cbb8e3'),
 'moss':('#9db6ae','#a5c0b3','#96adab','#b2c9b8','#839fa4','#d3c8ec'),
 'paving':('#cbbae8','#d4c4ed','#bdabd9','#e2d1f0','#a797cc','#f0d7eb'),
 'water':('#5077ad','#577fba','#496fa8','#678fc3','#365c99','#93c4de'),
}
atlas=Image.new('RGBA',(128,128))
records=[]
for i,(kind,colors) in enumerate(palette.items()):
    for variant in range(16):
        rng=random.Random(711+i*39+variant*9)
        im=Image.new('RGBA',(16,16),colors[0])
        d=ImageDraw.Draw(im)
        if kind=='paving':
            for x,y in [(2,2),(9,2),(5,8),(12,8),(2,13)]:
                w=rng.choice([3,4,5])
                if x+w<15:
                    d.line((x,y,x+w,y),fill=colors[2])
                    d.line((x+1,y+1,x+w,y+1),fill=colors[3])
        elif kind=='water':
            for j in range(5):
                x,y=rng.randrange(2,11),rng.randrange(2,14)
                d.line((x,y,min(13,x+rng.randrange(2,6)),y),fill=rng.choice(colors[1:4]))
            if not variant%3:d.line((4,7,8,7),fill=colors[5])
        else:
            for j in range(19):
                x,y=rng.randrange(1,14),rng.randrange(1,15)
                w=rng.choice([0,0,1,2])
                d.line((x,y,min(x+w,14),y),fill=rng.choice(colors[1:4]))
            if variant in [2,5,10,14]:
                for x,y in [(3,5),(4,4),(5,5),(4,6)]:
                    d.point((x,y),fill=colors[5])
        idx=i*16+variant
        atlas.paste(im,(idx%8*16,idx//8*16))
        records.append({'id':idx,'material':kind,'variant':variant})
atlas.save(assets/'terrain-atlas.png')
write('terrain-atlas',{'tileSize':16,'columns':8,'image':'terrain-atlas.png','tiles':records})
# Each row defines a stable world-space span. The bay uses real water cells.
spans={4:(12,21),5:(9,24),6:(7,26),7:(6,27),8:(5,28),9:(4,29),10:(4,29),11:(3,29),12:(3,29),13:(3,29),14:(3,29),15:(4,29),16:(4,29),17:(5,28),18:(5,28),19:(6,27),20:(8,25),21:(11,23)}
bay={8:(7,9),9:(6,10),10:(5,10),11:(4,10),12:(4,9),13:(3,9),14:(3,8),15:(5,7)}
paths=set()
for y,left,right in [(10,12,18),(11,11,19),(12,11,22),(13,10,24),(14,10,26),(15,10,29),(16,11,29),(17,12,17),(18,13,16)]:
    paths.update((x,y) for x in range(left,right+1))
def make_cell(x,y,chunk):
    rng=random.Random(x*991+y*291)
    wet=chunk=='frontyard' and y in bay and bay[y][0]<=x<=bay[y][1]
    mint=(y<=8 and (x<=10 or x>=19)) or (y>=17 and (x<=10 or x>=19)) or (chunk!='frontyard' and (y<=11 or y>=16))
    kind='water' if wet else 'paving' if (x,y) in paths or (chunk!='frontyard' and (y in (14,15))) else 'moss' if mint else 'lavender'
    return {'x':x,'y':y,'tile':list(palette).index(kind)*16+rng.randrange(16),'material':kind,'walkable':not wet,
        'placeable':not wet and ((18<=x<=26 and 10<=y<=17) or (14<=x<=18 and 17<=y<=19) or (chunk!='frontyard' and x>=33 and 12<=y<=15)),
        'chunk':chunk}
base=[make_cell(x,y,'frontyard') for y,(left,right) in spans.items() for x in range(left,right+1)]
extension={9:(30,33),10:(30,35),11:(30,37),12:(30,38),13:(30,39),14:(30,39),15:(30,39),16:(30,38),17:(29,37),18:(29,35),19:(28,32)}
east=[make_cell(x,y,'east') for y,(left,right) in extension.items() for x in range(left,right+1)]
write('terrain-map',{'id':'story-frontyard','projection':'orthogonal top-down 3/4','tileSize':16,'cells':base,'fixedHouse':{'x':15,'y':10},
 'spawns':[{'id':'tantan','name':'探探','x':12,'y':15},{'id':'zaozhao','name':'造造','x':18,'y':15},{'id':'manman','name':'慢慢','x':14,'y':17}],
 'interface':{'direction':'east','oldEdge':[29,14],'newLanding':[35,14]}})
write('expansion-chunk',{'id':'east','direction':'east','cells':east,'arrival':{'x':35,'y':14}})

if source is not None:
    v=source/'02-Game-Assets'
    def convert(src,name,weak=None):
        im=Image.open(src).convert('RGBA')
        im=im.crop(im.getbbox())
        if weak:
            im.thumbnail(weak,Image.Resampling.LANCZOS)
            colors=im.convert('RGB').quantize(colors=96).convert('RGBA')
            colors.putalpha(im.getchannel('A').point(lambda a:255 if a>=146 else 0))
            im=colors.crop(colors.getbbox())
        im.save(assets/(name+'.png'),optimize=True)
    for name in ['apple','apple-large','chair','leaf','stone','cat','plant-grown','mushrooms','crystal-flower']:
        convert(v/'v5-evolution'/(name+'.png'),name, (36,38) if name=='plant-grown' else None)
    for name,size in [('apple-house',(59,54)),('leaf-boat',(44,46)),('stone-rest',(64,53))]:
        convert(v/'v6-landmarks'/(name+'.png'),name,size)
    for name,size in [('lantern-tree',(62,69)),('dock',(40,38)),('observatory',(63,49)),('shore-rock',(36,27))]:
        convert(v/'v6-environment'/(name+'.png'),name,size)
    for name in ['tantan','zaozhao','manman']:
        for face in ['front','back','left','right']:
            convert(v/'v5-residents'/f'{name}-{face}.png',f'{name}-{face}')
    sky=source/'03-Tilemap/v5.1-expansion/Layers/v5-sky-plate.png'
    Image.open(sky).convert('RGB').save(assets/'sky.png',optimize=True)
