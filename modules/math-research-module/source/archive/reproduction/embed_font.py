from fontTools import subset
from fontTools.ttLib import TTFont
from pathlib import Path
import base64,re
base=Path(__file__).resolve().parent/'src/components/generated'
css=base/'MathExplorer.css'
original=css.read_text()
original=re.sub(r"/\* Noto Sans KR subset.*?\*/\s*@font-face\{.*?\}\s*",'',original,flags=re.S)
css.write_text(original)
text=''.join(p.read_text() for p in base.glob('*') if p.suffix in ['.tsx','.ts','.css'])
font=TTFont('/tmp/NotoSansKR-Regular.ttf')
opts=subset.Options();opts.flavor='woff';opts.layout_features=['*'];opts.name_IDs=['*'];opts.name_legacy=True;opts.name_languages=['*']
s=subset.Subsetter(options=opts);s.populate(text=text);s.subset(font)
for r in font['name'].names:
 if r.nameID in [1,4,6,16]: r.string='MathExplorerKR'.encode(r.getEncoding())
font.flavor='woff';font.save('/tmp/MathResearchKR.woff')
encoded=base64.b64encode(Path('/tmp/MathResearchKR.woff').read_bytes()).decode()
pre='/* Noto Sans KR subset renamed MathExplorerKR; source: Google Fonts.\n'+Path('/tmp/NotoSansKR-OFL.txt').read_text()+'\n*/\n'
pre+="@font-face{font-family:'MathExplorerKR';font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff;base64,"+encoded+") format('woff');}\n"
css.write_text(pre+original)
cmap=font.getBestCmap()
missing=sorted({ord(c) for c in text if 0xAC00<=ord(c)<=0xD7A3 and ord(c) not in cmap})
assert not missing,missing
print('Font bytes',Path('/tmp/MathResearchKR.woff').stat().st_size,'Korean missing',len(missing))
