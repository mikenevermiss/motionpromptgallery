#!/usr/bin/env python3
import json, os, re, subprocess, concurrent.futures as cf, sys, shutil, tempfile
from PIL import Image
P='/workspace/motionpromptgallery/public'
os.makedirs(P+'/videos',exist_ok=True); os.makedirs(P+'/posters',exist_ok=True)
items=json.load(open('/workspace/research/build/items_raw.json'))
man=json.load(open('/workspace/research/build/media_manifest.json'))
log=open('/workspace/research/build/fetch.log','a')
def L(*a): print(*a,file=log,flush=True)
def curl(url,out):
    r=subprocess.run(['curl','-sSfL','-A','Mozilla/5.0','--max-time','180','-o',out,url],capture_output=True,text=True)
    return r.returncode==0 and os.path.exists(out) and os.path.getsize(out)>500
def ff(args):
    r=subprocess.run(['ffmpeg','-y','-loglevel','error']+args,capture_output=True,text=True)
    if r.returncode: L('ffmpeg err',r.stderr[:300])
    return r.returncode==0
VID=['-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','28','-movflags','+faststart','-an']
SCALE="scale='min(720,iw)':-2"
def to_preview(src,dst,secs=10):
    return ff(['-i',src,'-t',str(secs),'-vf',SCALE]+VID+[dst])
def webp2mp4(src,dst):
    im=Image.open(src); n=getattr(im,'n_frames',1); tmp=tempfile.mkdtemp()
    durs=[]
    for i in range(n):
        im.seek(i); fr=im.convert('RGB'); fr.save(f'{tmp}/f{i:05d}.png'); durs.append(im.info.get('duration',80) or 80)
    fps=max(1,min(30,round(1000/(sum(durs)/len(durs)))))
    ok=ff(['-framerate',str(fps),'-i',f'{tmp}/f%05d.png','-vf',SCALE+",pad=ceil(iw/2)*2:ceil(ih/2)*2"]+VID+[dst])
    shutil.rmtree(tmp); return ok
def save_img(src,dst):
    im=Image.open(src); im.seek(0) if hasattr(im,'seek') else None
    im=im.convert('RGB'); im.thumbnail((960,960))
    ext=dst.rsplit('.',1)[1].lower()
    im.save(dst,'WEBP' if ext=='webp' else 'JPEG',quality=82); return True
def job(m):
    dst=P+m['dest']
    if os.path.exists(dst) and os.path.getsize(dst)>500: return m['dest'],True,'cached'
    url=m['url']; ext=url.split('?')[0].rsplit('/',1)[-1]; ext=ext.rsplit('.',1)[-1] if '.' in ext else 'bin'; tmp=tempfile.mktemp(suffix='.'+re.sub(r'[^a-z0-9]','',ext.lower())[:5])
    if m.get('transform')=='render': return m['dest'],None,'deferred'
    if url.startswith('file://'): shutil.copy(url[7:],tmp); ok=True
    else: ok=curl(url,tmp)
    if not ok: return m['dest'],False,'download failed '+url
    t=m.get('transform')
    try:
        if m['kind']=='poster': ok=save_img(tmp,dst)
        elif t=='webp2mp4': ok=webp2mp4(tmp,dst)
        elif t in ('webm2mp4','preview'): ok=to_preview(tmp,dst,12 if t=='webm2mp4' else 10)
        else: shutil.move(tmp,dst); ok=True
    except Exception as e: ok=False; L('err',m['dest'],e)
    if os.path.exists(tmp): os.remove(tmp)
    return m['dest'],ok,t
def skillry(it):
    s=it['_skillry']; vdst=f"/videos/{it['slug']}.mp4"; pdst=f"/posters/{it['slug']}.webp"
    res=[]
    if not os.path.exists(P+vdst):
        page=subprocess.run(['curl','-sS','--max-time','60','https://skillry.dev/ai-videos/opus-5-5/'+s],capture_output=True,text=True).stdout
        c=re.findall(r'https://media\.skillry\.dev/opus-5-5/'+re.escape(s)+r'/original-card\.[0-9a-f]+\.mp4',page) or re.findall(r'https://media\.skillry\.dev/opus-5-5/'+re.escape(s)+r'/original\.mp4',page)
        if c:
            tmp=tempfile.mktemp(suffix='.mp4')
            if curl(c[0],tmp):
                if os.path.getsize(tmp)>3_000_000: to_preview(tmp,P+vdst,10); os.remove(tmp)
                else: shutil.move(tmp,P+vdst)
    if not os.path.exists(P+pdst):
        tmp=tempfile.mktemp(suffix='.webp')
        if curl(it['_posterurl'],tmp): save_img(tmp,P+pdst); os.remove(tmp)
    it['video']=vdst if os.path.exists(P+vdst) else None
    it['poster']=pdst if os.path.exists(P+pdst) else None
    return it['slug'],it['video'],it['poster']
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(skillry,[i for i in items if i.get('_skillry')]): L('skillry',r)
    results={}
    for d,ok,info in ex.map(job,man): results[d]=ok; L('media',d,ok,info)
# drop failed media refs (keep deferred renders)
for it in items:
    for k in ('video','poster'):
        v=it.get(k)
        if v and not v.startswith('/posters/') and not v.startswith('/videos/'): it[k]=None
        if v and v in results and results[v] is False: it[k]=None
        if v and results.get(v) is None and not os.path.exists(P+v) and not v.endswith('.png'): it[k]=None
# poster from first frame where missing
for it in items:
    if it.get('video') and not it.get('poster'):
        dst=f"/posters/{it['slug']}.jpg"
        if ff(['-ss','1','-i',P+it['video'],'-frames:v','1','-vf',"scale='min(960,iw)':-2",P+dst]): it['poster']=dst
# aspect ratio
def dims(path):
    try:
        if path.endswith(('.mp4','.webm')):
            o=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0',path],capture_output=True,text=True).stdout.strip().split(',')
            return int(o[0]),int(o[1])
        return Image.open(path).size
    except Exception: return None
for it in items:
    src=it.get('video') or it.get('poster')
    if src and os.path.exists(P+src):
        d=dims(P+src)
        if d: it['aspectRatio']=f'{d[0]}/{d[1]}'
for it in items:
    it['tags']=list(dict.fromkeys(it.get('tags') or []))
    for k in list(it):
        if k.startswith('_'): del it[k]
json.dump(items,open('/workspace/research/build/items_media.json','w'),indent=1,ensure_ascii=False)
L('DONE', sum(1 for i in items if i.get('video')), 'videos', sum(1 for i in items if i.get('poster')),'posters')
print('DONE')
