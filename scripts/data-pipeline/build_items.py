#!/usr/bin/env python3
"""Builds data/items.json + media manifest from real, sourced research data.
Every item cites a real source URL; prompts are copied verbatim from sources."""
import json, re, os, html, datetime, collections, subprocess, hashlib
R='/workspace/research'
OUT='/workspace/motionpromptgallery/data/items.json'
MAN='/workspace/research/build/media_manifest.json'
items=[]; media=[]

def snow_date(tid):
    try:
        ms=(int(tid)>>22)+1288834974657
        return datetime.datetime.fromtimestamp(ms/1000,datetime.timezone.utc).strftime('%Y-%m-%d')
    except: return None

def slugify(s):
    s=s.lower(); s=re.sub(r'[^a-z0-9]+','-',s).strip('-')
    return s[:60].strip('-') or 'item'

def title_from_prompt(p, n=64, fallback=None):
    first=next((l.strip().lstrip('#').strip() for l in p.strip().splitlines() if l.strip()),'')
    first=re.split(r'(?<=[.!?。])\s',first)[0].strip().strip('"“”*')
    if not re.match(r'(?i)^(create|make|build|render|design|generate|animate|produce)\b',first) or not first.isascii() or len(first)<20:
        return fallback or 'Untitled'
    first=first[0].upper()+first[1:]
    return first if len(first)<=n else first[:n].rsplit(' ',1)[0]+'…'

def add(**kw):
    base=dict(code=None,tags=[],video=None,poster=None,aspectRatio='16/9',stack='',type='prompt')
    base.update(kw); items.append(base); return base

def want_media(item, url, kind, ext, transform=None):
    fn=f"{item['slug']}.{ext}"
    path=f"/videos/{fn}" if kind=='video' else f"/posters/{fn}"
    media.append(dict(url=url,kind=kind,dest=path,transform=transform,slug=item['slug']))
    item['video' if kind=='video' else 'poster']=path

# ---------------- Claude Opus 5.5 : yihui-dev/awesome-opus5-5-videos (+ zhuyansen metadata) -------------
yv=json.load(open(f'{R}/awesome-opus5-5-videos/data/videos.json'))
zc={x['id']:x for x in json.load(open(f'{R}/awesome-opus-5.5-video/cases.json'))['cases']}
STACK={'canvas':'Canvas','svg':'SVG','threejs':'Three.js','shader':'GLSL','gsap':'GSAP','css':'CSS','audio':'Web Audio','particles':'Particles','pixel':'Pixel art','webgl':'WebGL','physics':'Physics','ai-image':'AI images','playable':'Playable'}
SHOWREEL=re.compile(r'15[- ]second motion graphics video that shows what an incredible motion designer',re.I)
cands=[x for x in yv if x['category'] in ('motion','explainer') and len(x['prompt'].strip())>=20]
# rank: zhuyansen-joined first (titles + exact dates), then full prompts, then longer prompts
def rank(x):
    tid=x['post_url'].rstrip('/').split('/')[-1]
    return (tid not in zc, x['prompt_partial'], -min(len(x['prompt']),1200))
cands.sort(key=rank)
seen_prompt=collections.Counter(); showreel=0; opus=[]
for x in cands:
    key=re.sub(r'\W+','',x['prompt'].lower())[:160]
    is_sr=bool(SHOWREEL.search(x['prompt']))
    if is_sr:
        if showreel>=6: continue
        showreel+=1
    elif seen_prompt[key]>=1: continue
    seen_prompt[key]+=1
    opus.append(x)
    if len(opus)>=80: break
for x in opus:
    tid=x['post_url'].rstrip('/').split('/')[-1]
    z=zc.get(tid)
    handle=x['author']
    name=(z['creator']['name'] if z else handle)
    if z: title=z['title']['en']
    elif SHOWREEL.search(x['prompt']): title=f'“Incredible motion designer” showreel'
    else: title=title_from_prompt(x['prompt'],fallback=f'Motion piece by @{handle}')
    stack=' + '.join(STACK.get(t,t) for t in x['tech_tags'][:3]) or 'HTML'
    note=('Prompt verbatim from github.com/yihui-dev/awesome-opus5-5-videos (prompts/%s.md)'%x['slug'])
    if x['prompt_partial']: note+='; marked there as a partial prompt (the creator did not publish the full text)'
    if z and z.get('reference_assets'): note+='; the creator also supplied their own reference assets'
    if z: note+='; title/date from github.com/zhuyansen/awesome-opus-5.5-video'
    else: note+='; posted date derived from the X post ID; the title is an editorial label (the source has no title)'
    note+='. Preview clip and poster: Skillry media of the original post (skillry.dev/ai-videos/opus-5-5/%s).'%x['slug']
    it=add(id=f"opus55-{x['slug']}",title=title,slug=slugify(f"{title}-{handle}")[:70],model='Claude Opus 5.5',type='prompt',
        creatorName=name,handle='@'+handle,postUrl=x['post_url'],postedAt=(z['posted_at'][:10] if z else snow_date(tid)),
        stack=stack,prompt=x['prompt'].strip(),tags=sorted(set([x['category']]+x['tech_tags'][:4])),sourceNote=note)
    it['_skillry']=x['slug']; it['_posterurl']=x['poster_url']

# ---------------- GPT-6 Astra : OpenAI Developers showcase ----------------
sc=json.load(open(f'{R}/openai/showcase.json'))
PICK=['abyssal-bioluminescent-ecosystem','impossible-kinetic-architecture','living-cell-cross-section','tidegarden','stop-motion-desk',
      'little-ritual','velocity-loop','sunwake','void-explorer','hollowflux','below-the-surface','type-field','courtyard-house','physics-museum','nightjar-listening-room','tidal-house']
for o in sc:
    if o['slug'] not in PICK: continue
    m=re.match(r'(.*?)\s+by\s+(.*)',o['h1']); title=m.group(1).strip(); by=re.sub(r'\s+',' ',m.group(2)).strip()
    person=by.replace(', OpenAI','').strip()
    steps=o['steps'] or []
    prompts=[]
    for st in steps:
        for ps in st.get('processSteps') or []:
            for p in ps.get('prompts') or []:
                prompts.append((ps.get('title'),p.get('text','').strip()))
    first=prompts[0][1]
    code=None
    if len(prompts)>1:
        code='Follow-up prompts in the published build process:\n\n'+'\n\n'.join(f'— {t}:\n{tx}' for t,tx in prompts[1:])
    clean=[u.split('&quot;')[0] for u in o['media']]
    vids=[u for u in clean if u.endswith('.webm')]
    imgs=[u for u in clean if re.search(r'/(final|cover|finished)[^/]*\.webp$',u)] or [u for u in clean if u.endswith('.webp')]
    it=add(id=f"astra-openai-{o['slug']}",title=title,slug=slugify(title+'-openai'),model='GPT Astra',type='prompt',creatorName=f'{person} (OpenAI)',
        handle='@OpenAIDevs',postUrl=f"https://developers.openai.com/showcase/{o['slug']}",postedAt=None,stack='Codex · single-file web (HTML/WebGL)',
        prompt=first,code=code,tags=['official showcase','3d','webgl'],
        sourceNote=f"Official OpenAI Developers showcase page labelled GPT-6 Astra; initial prompt copied verbatim from the page's build process ({len(prompts)} prompts total, follow-ups in the Code tab). Handle is OpenAI Developers' account, the page credits {person}. Post date not shown on the page. Media from cdn.openai.com.")
    if imgs: want_media(it,imgs[-1] if 'final' in imgs[-1] else imgs[0],'poster','webp')
    if vids: want_media(it,vids[0],'video','mp4',transform='webm2mp4')

# ---------------- GPT-6 Astra : LuxRealGrowth/awesome-astra-video-prompts ----------------
lx=open(f'{R}/awesome-astra-video-prompts/README.md').read()
def lx_sec(head):
    i=lx.find('### '+head); j=lx.find('\n### ',i+4); return lx[i:j]
def codes(sec): return re.findall(r'```[a-z]*\n(.*?)```',sec,re.S)
LUX=[ # (heading, title, codeIndex, type, stack, partial?)
 ('1: High-Speed Parkour Motion Previz','High-speed parkour motion previz',0,'prompt','Remotion + WebGL (TypeScript)',False),
 ('2: AdCar TV','AdCar TV one-shot launch video',0,'prompt','Remotion + ffmpeg + Qwen 3 TTS',False),
 ('5: T Cells','T cells: a 5-minute explainer from one line',0,'prompt','Remotion plugin + Imagegen + HeyGen',False),
 ('Atomik — 33-Second Launch Film','Atomik 33-second launch film',None,'skill','Remotion / HyperFrames + motion-flavor skill',True),
 ('Ultra-High-Speed Sprint Control MP4','Ultra-high-speed sprint control MP4',0,'prompt','Remotion',False),
 ('Side-Scrolling Chase, with a Frame Table','Side-scrolling chase with a frame table',0,'prompt','Remotion',False),
 ('30 Camera Compositions','30 camera compositions reference sheet',0,'prompt','Remotion + HTML/CSS/SVG',True),
]
for head,title,ci,typ,stack,partial in LUX:
    sec=lx_sec(head)
    x=re.search(r'https://x\.com/([A-Za-z0-9_]+)/status/(\d+)',sec)
    auth=re.search(r'\*\*Author:\*\*\s*([^\(\|\n]+?)\s*\(\[@',sec)
    webp=re.search(r'src="(media/[^"]+\.webp)"',sec)
    pub=re.search(r'\*\*Published:\*\*\s*(\d{4}-\d{2}-\d{2})',sec)
    cs=codes(sec)
    if typ=='skill':
        prompt=('Skill: motion-flavor (the creator\'s own skill, works on HyperFrames and Remotion). The chat prompt was not published. '
                'Source repo: https://github.com/Tejashmakwana/astra-atomik-launch-video\n\nCreator\'s post, verbatim:\n'+cs[0].strip())
        code='Spec from the source repo (acceptance contract):\n\n'+cs[1].strip()
    else:
        prompt=cs[ci].strip(); code=None
        if head.startswith('5: T Cells'): code='Orchestration the author described afterwards (not the original prompt):\n\n'+cs[1].strip()
    it=add(id=f"astra-lux-{slugify(title)}",title=title,slug=slugify(title),model='GPT Astra',type=typ,creatorName=auth.group(1).strip() if auth else x.group(1),
        handle='@'+x.group(1),postUrl=x.group(0),postedAt=pub.group(1) if pub else snow_date(x.group(2)),stack=stack,prompt=prompt,code=code,
        tags=['video','remotion'],sourceNote='Prompt verbatim from github.com/LuxRealGrowth/awesome-astra-video-prompts (CC BY 4.0)'+(' — listed there as partial text' if partial else '')+'; preview clip is the short excerpt hosted in that repo (media/), converted to MP4.'+('' if pub else ' Date derived from the X post ID.'))
    if webp: want_media(it,'file://'+f'{R}/awesome-astra-video-prompts/'+webp.group(1),'video','mp4',transform='webp2mp4')
# leon7hao short brief
sec=lx[lx.find('根据最近的 changelog'):]
it=add(id='astra-lux-changelog-video',title='Changelog highlight video (no skill installed)',slug='changelog-highlight-video-leon7hao',model='GPT Astra',type='prompt',
    creatorName='leon7hao',handle='@leon7hao',postUrl='https://x.com/leon7hao/status/2096844989900914865',postedAt=snow_date('2096844989900914865'),stack='Remotion (Codex, GPT-6 Astra medium)',
    prompt='根据最近的 changelog 比较亮眼的功能做个视频。',tags=['video','short brief'],
    sourceNote='Prompt from github.com/LuxRealGrowth/awesome-astra-video-prompts ("Short Briefs" section, partial); the author reported the result was weaker without a skill installed. Date derived from the X post ID. Preview excerpt from that repo, converted to MP4.')
want_media(it,'file://'+f'{R}/awesome-astra-video-prompts/media/changelog-video.webp','video','mp4',transform='webp2mp4')

# ---------------- comparisons (jasonzhu.ai pages, zhuyansen metadata) ----------------
def jz_prompt(tid):
    s=open(f'{R}/jz/{tid}.html').read()
    p=re.findall(r'<pre[^>]*>(.*?)</pre>',s,re.S)[0]
    return html.unescape(re.sub('<[^>]+>','',p)).strip()
COMP=[ # tid, model, title, extra note
 ('2104994617573970308','GPT Astra','The Watermelon Test (rubber bands, Three.js)','Side-by-side post: Claude Opus 5.5 vs GPT-6 Astra; the Astra build is one half of the video.'),
 ('2104466170275324190','GPT Astra','Octo Jelly: squishable gummy octopus (WebGPU)','Side-by-side post comparing Claude Opus 5.5 and ChatGPT-6 Astra.'),
 ('2104651061336117614','GPT Astra','Jellyfish Jelly: squishable gummy jellyfish (WebGPU)','Two-model build: Claude Sonnet 5.5 and ChatGPT-6 Astra.'),
 ('2102770788319310302','GPT Astra','Lava lamp, four ways','Four-model comparison (Claude Opus 5.5, GPT-6 Astra, GPT-6 Sol, GPT-6 Luna).'),
 ('2103120423005425972','GPT Astra','Pixel-art cheetah run','Comparison of Claude Opus 5.5 and GPT-6 Astra Max.'),
 ('2104924603126603893','GPT Astra','“Build what you think you look like”','Self-portrait challenge: Claude Sonnet 5.5 vs GPT-6 Astra.'),
 ('2103420244018573385','Fable 5','Ultra-realistic flight simulator','Side-by-side post: Claude Fable 5 vs Claude Opus 5.5.'),
]
for tid,model,title,extra in COMP:
    z=zc[tid]
    jzs=open(f'{R}/jz/{tid}.html').read()
    src=re.search(r'https://x\.com/[A-Za-z0-9_]+/status/\d+',jzs)
    it=add(id=f"cmp-{tid}",title=title,slug=slugify(title+'-'+z['creator']['handle']),model=model,type='prompt',creatorName=z['creator']['name'],
        handle='@'+z['creator']['handle'],postUrl=z['original_post_url'],postedAt=z['posted_at'][:10],stack=' + '.join(z['tools_reported']) or 'HTML',
        prompt=jz_prompt(tid),tags=['comparison',z['category']],
        sourceNote=f"{extra} Prompt verbatim via jasonzhu.ai/en/prompts/claude-opus-5-5/{tid} (prompt source: {src.group(0) if src else 'original post'}); metadata from github.com/zhuyansen/awesome-opus-5.5-video. Poster is the X video thumbnail.")
    if z.get('thumbnail_url'): want_media(it,z['thumbnail_url'],'poster','jpg')

# ---------------- Hyper3D / Tripo 3D-prompt pages (Kimi K3 + Fable 5) ----------------
h3=json.load(open(f'{R}/h3d/h3d.json'))
H3PICK={ # slug tail -> (model, title override or None, tags)
 '2082528683747873194':('Kimi K3','Cracking aquarium simulation',['simulation','3d']),
 '2082451081733591520':('Kimi K3','Explorable workstation room (“surprise me”)',['3d','scene']),
 '2079590483727442205':('Kimi K3','Gargantua black-hole geodesic raytracer (WebGL2)',['simulation','shader']),
 '2079553757302710442':('Kimi K3','Voxel soccer goal animation',['animation','3d']),
 '2082832042702561372':('Kimi K3','3D destruction physics: trucks, canyon jump, anvil',['simulation','3d']),
 '2080757148078768504':('Kimi K3','Procedural guns that fire and disassemble',['3d','procedural']),
 '2080178541979664741':('Fable 5','Procedural 3D cherry blossom tree',['3d','generative']),
 '2081200833656451322':('Fable 5','Cinematic jungle helicopter flight',['animation','3d']),
 '2080834581247435102':('Fable 5','Hand-drawn Japanese suburban street',['3d','scene']),
 '2080454415400493332':('Fable 5','Maglev train in a glass vacuum tube',['animation','3d']),
 '2081533777340506251':('Fable 5','Infinite paper machine',['animation','3d']),
 '2079198084689723560':('Fable 5','Voxel soccer goal animation',['animation','3d']),
 '2078806166122197132':('Fable 5','Walk-through 3D airplane',['3d','scene']),
}
for o in h3:
    tail=o['slug'][-19:]
    if tail not in H3PICK or (H3PICK[tail][0]=='Kimi K3')!=(o['listing']=='kimi-k3'): continue
    if not o['x']: continue
    model,title,tags=H3PICK[tail]
    xurl=o['x'][0]; handle=xurl.split('/')[3]
    it=add(id=f"h3d-{tail}-{slugify(model)}",title=title,slug=slugify(title+'-'+handle+('-k3' if model=='Kimi K3' else '-fable5')),model=model,type='prompt',creatorName=o['author']['name'],handle='@'+handle,
        postUrl=xurl,postedAt=o['date'],stack='Three.js · single HTML file',prompt=o['prompt'],tags=tags,
        sourceNote=f"Prompt as published on hyper3d.ai/3d-prompts/{o['slug']} (mirrors tripo3d.ai, which cites the original X post); model per those pages. Poster image from that page.")
    if o.get('image'): want_media(it,o['image'],'poster','jpg')

# ---------------- Claude Fable 5 : elder-plinius/FABLE-SHOWCASE ----------------
PL=f'{R}/elder-plinius_FABLE-SHOWCASE'
pl_prompt=re.search(r'## Prompt\n\n(.*?)\n\n## ',open(f'{PL}/README.md').read(),re.S).group(1).strip()
gal=open(f'{PL}/index.html').read()
# gallery metadata (title/description per demo) if present
demos=sorted(d for d in os.listdir(PL) if os.path.isdir(f'{PL}/{d}') and os.path.exists(f'{PL}/{d}/index.html') and d!='thumbs')
def demo_title(d):
    s=open(f'{PL}/{d}/index.html',errors='ignore').read()
    t=re.search(r'<title>(.*?)</title>',s,re.S)
    return html.unescape(t.group(1)).strip() if t else d.replace('-',' ').title()
def commit_date(path):
    r=subprocess.run(['git','-C',PL,'log','--diff-filter=A','--format=%aI','--',path],capture_output=True,text=True).stdout.strip().splitlines()
    return r[-1][:10] if r else None
for d in demos:
    t=demo_title(d); t=t[0].upper()+t[1:]
    it=add(id=f"fable5-plinius-{d}",title=t,slug=slugify(t+'-plinius'),model='Fable 5',type='prompt',creatorName='Pliny (elder-plinius)',handle='@elder-plinius',
        postUrl=f'https://github.com/elder-plinius/FABLE-SHOWCASE/tree/main/{d}',postedAt=commit_date(d),stack='Claude Code · single index.html, zero dependencies',
        prompt=pl_prompt,code=f'Source: https://github.com/elder-plinius/FABLE-SHOWCASE/blob/main/{d}/index.html',tags=['generative','single file','multi-agent'],
        sourceNote='From github.com/elder-plinius/FABLE-SHOWCASE: 57 demos built by ~275 Claude Fable 5 sub-agent runs from one prompt (the prompt shown, verbatim from the README). Handle is the GitHub account. Date = repo commit date. Poster = the repo\'s own headless-browser thumbnail.')
    th=f'{PL}/thumbs/{d}.jpg'
    if os.path.exists(th): want_media(it,'file://'+th,'poster','jpg')

# ---------------- Claude Fable 5 : misc single sources ----------------
it=add(id='fable5-scottstts-friends',title='Monica’s apartment from Friends, first-person in Three.js',slug='friends-apartment-threejs-scottstts',model='Fable 5',type='prompt',
    creatorName='scottstts',handle='@scottstts',postUrl='https://x.com/scottstts/status/2064464351906673029',postedAt='2026-06-09',stack='Three.js · single HTML file',
    prompt='in @threejs, create a first person pov navigable 3d scene of the iconic Monica\'s apartment from tv show Friends correctly based on this floor plan, stay true to the original look and feel, use warm lighting',
    tags=['3d','scene'],sourceNote='Prompt quoted in the creator\'s post, as archived in github.com/Anil-matcha/awesome-claude-fable-5 (Case 15). The creator also supplied a floor-plan image.')

RUSH=open(f'{R}/build/rush_prompt.txt').read().strip() if os.path.exists(f'{R}/build/rush_prompt.txt') else None
if RUSH:
    for model,mid,note in [('Kimi K3','kimi-k3','Kimi K3 (free-tier K3 Max on kimi.com) got this one prompt only — an unrefined one-shot.'),
                           ('Fable 5','claude-fable','The Claude Fable build continued with several guidance prompts after this starting prompt. The article says “Claude Fable” (July 2026); Fable 5 was the only Fable release then (5.1 shipped Sept 1).')]:
        add(id=f'rush-{mid}',title='Rolling the obelisk: 3D Egyptology physics explainer',slug=f'rush-test-egyptology-{mid}',model=model,type='prompt',creatorName='Terry Lurie',handle='generative-ai.review',
            postUrl='https://generative-ai.review/2026/07/kimi-k3-rush-test-vs-claude-fable/',postedAt='2026-07-16',stack='Three.js (CDN) + CSS2DRenderer · single HTML file',prompt=RUSH,tags=['3d','explainer','comparison'],
            sourceNote='Starting prompt verbatim from the article\'s appendix (the author says it was written by Google Gemini). '+note)

# ---------------- Kimi K3 : misc ----------------
ev=json.load(open(f'{R}/Evolink-AI_awesome-kimi-k3-usecases/data/use-cases.json'))['items'][0]
it=add(id='kimi-ivanfioravanti-podracer',title='Voxel pod-racer run',slug='voxel-pod-racer-ivanfioravanti',model='Kimi K3',type='prompt',creatorName='Ivan Fioravanti',handle='@ivanfioravanti',
    postUrl=ev['source_url'],postedAt=ev['date'],stack='Voxel 3D · browser',prompt=ev['prompt_text'],tags=['3d','voxel'],
    sourceNote='From github.com/Evolink-AI/awesome-kimi-k3-usecases (case 1, the only case there with a public exact prompt). The creator reports Kimi K3 made v1 from this single prompt. Video and poster from that repo\'s public media bucket.')
want_media(it,ev['media_assets'][0]['url'],'video','mp4',transform='preview')
want_media(it,ev['media_assets'][0]['poster_url'],'poster','jpg')
MAN3=f'{R}/HarleyCoops_KimiK3Manim'
ricci=open(f'{MAN3}/prompts/RicciFlowFilm.tex').read().strip()
LFS='https://media.githubusercontent.com/media/HarleyCoops/KimiK3Manim/main/assets/'
it=add(id='kimi-manim-melting-space',title='Melting Space: Ricci flow and the Poincaré conjecture',slug='melting-space-ricci-flow-kimik3manim',model='Kimi K3',type='prompt',creatorName='HarleyCoops',handle='@HarleyCoops',
    postUrl='https://github.com/HarleyCoops/KimiK3Manim',postedAt=None,stack='Manim Community Edition (Python, LaTeX)',prompt=ricci,
    code='Scene source: https://github.com/HarleyCoops/KimiK3Manim/blob/main/manim_scenes/melting_space.py',tags=['math','manim','3d','explainer'],
    sourceNote='From github.com/HarleyCoops/KimiK3Manim README: a ~2-minute film “imagined, scripted, and rendered by Kimi K3 in a single session — from a verbose per-scene prompt it wrote for itself” (prompts/RicciFlowFilm.tex, shown verbatim). Handle is the GitHub account. Preview is a short excerpt of the repo\'s MeltingSpace.mp4.')
want_media(it,LFS+'MeltingSpace.mp4','video','mp4',transform='preview')
SK='Skill: KimiK3Manim, a six-agent Kimi K3 pipeline (concept → prerequisites → math enrichment → visual design → screenplay → Manim code → self-review of rendered frames). Repo: https://github.com/HarleyCoops/KimiK3Manim'
for sid,title,asset,scene,desc in [
  ('euler','Euler’s Identity, a 3.5-minute K3 swarm film','EulerIdentityFilm.mp4',None,'“written, staged, rendered, and self-critiqued by the six-agent K3 swarm from a single verbose LaTeX-rich prompt” (that prompt is not published in the repo)'),
  ('reverse-reasoning','Reverse Reasoning: a K3 protocol film','K3ReverseReasoning.mp4','manim_scenes/k3_reverse_reasoning.py','“designed and directed by Kimi K3 itself in a single session”'),
]:
    it=add(id=f'kimi-manim-{sid}',title=title,slug=slugify(title+'-kimik3manim'),model='Kimi K3',type='skill',creatorName='HarleyCoops',handle='@HarleyCoops',
        postUrl='https://github.com/HarleyCoops/KimiK3Manim',postedAt=None,stack='Manim Community Edition (Python, LaTeX)',prompt=SK,
        code=(f'Scene source: https://github.com/HarleyCoops/KimiK3Manim/blob/main/{scene}' if scene else None),tags=['math','manim','skill'],
        sourceNote=f'From github.com/HarleyCoops/KimiK3Manim README: {desc}. Listed as a Skill entry (the pipeline is the published artifact). Preview is a short excerpt of the repo\'s {asset}.')
    want_media(it,LFS+asset,'video','mp4',transform='preview')

# ---------------- Command Code /design showcase (Kimi K3, Fable 5) ----------------
CC=f'{R}/slash-design-showcase'
def cc_prompt(d):
    s=open(f'{CC}/{d}/readme.md').read()
    m=re.search(r'## Prompt\s*\n(.*?)(?:\n\s*https://commandcode\.ai/share/\S+|\n## )',s,re.S)
    p=m.group(1)
    p='\n'.join(l.rstrip() for l in p.strip().splitlines())
    p=re.sub(r'^>\s?','',p,flags=re.M).strip()
    share=re.search(r'https://commandcode\.ai/share/\S+',s)
    return p, share.group(0) if share else None
CCPICK=[('kimi-k3-design/3d-portfolio','.','Kimi K3','“Crafting Worlds in Motion” 3D designer portfolio'),
        ('kimi-k3-design/agency','.', 'Kimi K3','NEON VOID: liquid-metal text studio site'),
        ('kimi-k3-design/scroll-experiment','kimi-k3','Kimi K3','Kael Thorn: scroll-driven dimension journey'),
        ('kimi-k3-design/product','.', 'Kimi K3','NEXUS Audio: 3D earbuds product page'),
        ('kimi-k3-design/creative-portfolio','kimi-k3','Kimi K3','Awwwards-style creative portfolio'),
        ('kimi-k3-design/creative-portfolio','fable-5','Fable 5','Awwwards-style creative portfolio'),
        ('kimi-k3-design/story-telling','kimi-k3','Kimi K3','Cinematic scroll-driven storytelling page'),('kimi-k3-design/story-telling','fable-5','Fable 5','Cinematic scroll-driven storytelling page'),
        ('kimi-k3-design/photography','fable-5','Fable 5','Elena Voss: 3D floating-frame photography portfolio'),
        ('kimi-k3-design/photography','kimi-k3','Kimi K3','Elena Voss: 3D floating-frame photography portfolio')]
for d,sub,model,title in CCPICK:
    if not os.path.exists(f'{CC}/{d}/readme.md'): continue
    p,share=cc_prompt(d)
    html_path=f'{CC}/{d}/{sub}/index.html' if sub!='.' else f'{CC}/{d}/index.html'
    if not os.path.exists(html_path) and os.path.exists(f'{CC}/{d}/index.html') and sub!='.': html_path=None
    if html_path is None: continue
    if not os.path.exists(html_path):
        cand=[f for f in os.listdir(os.path.dirname(html_path)) if f.endswith('.html')] if os.path.isdir(os.path.dirname(html_path)) else []
        if not cand: continue
        html_path=os.path.join(os.path.dirname(html_path),cand[0])
    t=title or title_from_prompt(p)
    rel=os.path.relpath(html_path,CC)
    date=(subprocess.run(['git','-C',CC,'log','--diff-filter=A','--format=%aI','--',rel],capture_output=True,text=True).stdout.strip().splitlines() or [''])[-1][:10] or None
    it=add(id=f"cc-{slugify(d)}-{slugify(model)}",title=t,slug=slugify(t+'-'+model+'-commandcode'),model=model,type='prompt',creatorName='Command Code',handle='@CommandCodeAI',
        postUrl=f'https://github.com/CommandCodeAI/slash-design-showcase/tree/main/{os.path.dirname(rel)}',postedAt=date,stack='Tailwind + Three.js/GSAP · single HTML (Command Code /design)',
        prompt=p,code=f'Output: https://github.com/CommandCodeAI/slash-design-showcase/blob/main/{rel}'+(f'\nSession: {share}' if share else ''),tags=['web','landing page','one-shot'],
        sourceNote=f'From github.com/CommandCodeAI/slash-design-showcase ({d}); same prompt run per model with the /design command. Date = date the file was first committed to the repo. Poster = screenshot of the published HTML output, rendered locally in headless Chromium.')
    media.append(dict(url='file://'+html_path,kind='poster',dest=f"/posters/{it['slug']}.png",transform='render',slug=it['slug'])); it['poster']=f"/posters/{it['slug']}.png"

# ---------------- finalize ----------------
seen=set()
for it in items:
    s=it['slug']; n=2
    while it['slug'] in seen: it['slug']=f'{s}-{n}'; n+=1
    seen.add(it['slug'])
NAMES={'Fable 5':'Claude Fable 5','GPT Astra':'GPT-6 Astra'}
for it in items: it['model']=NAMES.get(it['model'],it['model'])
# fix media dest after slug dedupe
bymedia=collections.defaultdict(list)
for m in media: bymedia[m['slug']].append(m)
final_media=[]
for it in items:
    pass
json.dump(items,open('/workspace/research/build/items_raw.json','w'),indent=1,ensure_ascii=False)
json.dump(media,open(MAN,'w'),indent=1,ensure_ascii=False)
print(collections.Counter(i['model'] for i in items), len(items), 'media', len(media))
