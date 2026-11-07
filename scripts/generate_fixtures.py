#!/usr/bin/env python3
"""Deterministic SYNTHETIC legacy fixtures. No Riot/valorant-api artwork is included."""
from pathlib import Path
import json, struct, zlib, zipfile, io, copy
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'fixtures'/'generated'; SAMPLES=ROOT/'fixtures'/'samples'
OUT.mkdir(parents=True,exist_ok=True); SAMPLES.mkdir(parents=True,exist_ok=True)
def png(w,h,kind):
    rows=[]
    for y in range(h):
        row=bytearray()
        for x in range(w):
            base={'stand':(22,35,48),'aim':(35,48,58),'landing':(42,52,45),'aim2':(48,38,55),'stand2':(30,42,55),'step':(50,45,35)}[kind]
            grid=(x%40<1 or y%40<1)
            c=tuple(min(255,v+18) for v in base) if grid else base
            if kind.startswith('aim') and (abs(x-w/2)<1 or abs(y-h/2)<1) and (x-w/2)**2+(y-h/2)**2 < (w*.08)**2: c=(210,225,230)
            if kind=='landing' and ((x-w*.62)**2+(y-h*.55)**2)**.5 < w*.07: c=(110,160,105)
            row.extend(c)
        rows.append(b'\x00'+row)
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows)))+chunk(b'IEND',b'')
MEDIA={
 'media/asset_aaaaaaa.jpg':png(320,180,'stand'),
 'media/asset_bbbbbbb.jpg':png(640,360,'aim'),
 'media/asset_ccccccc.jpg':png(400,225,'landing'),
 'media/asset_ddddddd.jpg':png(320,180,'stand2'),
 'media/asset_eeeeeee.jpg':png(640,360,'aim2'),
 'media/asset_fffffff.jpg':png(320,180,'step'),
}
# Extensions in the old app are .jpg, but these synthetic bytes are intentionally PNG to test content sniffing.
CIRCLE={'id':'circle-corrode-1','color':'cyan','x':0.5,'y':0.5,'radius':0.025,'showZoom':True,'zoomScale':3.5,'zoomSize':0.24,'zoomX':0.72,'zoomY':0.04,'legacyNote':'preserve me'}
def lineup(id,map_uuid,agent_uuid,slot,title,mode_attrs=None,double=False,missing=False):
    attrs={'chargeStage':'1','chargeBars':'2','bounces':'0','doubleShock':double,'hasSecondStand':double,'stand2Image':'media/asset_ddddddd.jpg' if double else None,'stand2Point':{'x':0.6,'y':0.65} if double else None,'slotCircles':{k:[] for k in ['stand1','aim1','stand2','aim2','landing']},'projectiles':[{'index':0,'label':'Primary','aimImage':'media/asset_bbbbbbb.jpg','standImage':'media/asset_aaaaaaa.jpg','chargeStage':'1','chargeBars':'2','bounces':'0','throwType':'normal','focusCircles':[]}],'futureAttribute':{'nested':[1,'two']}}
    if mode_attrs: attrs.update(mode_attrs)
    if double: attrs['projectiles'].append({'index':1,'label':'Follow-up','aimImage':'media/asset_eeeeeee.jpg','standImage':'media/asset_ddddddd.jpg','chargeStage':'2','chargeBars':'2','bounces':'0','throwType':'normal','focusCircles':[]})
    media={'standImage':'media/asset_aaaaaaa.jpg','aimImage':'media/asset_bbbbbbb.jpg','landingImage':'media/asset_missing.jpg' if missing else 'media/asset_ccccccc.jpg','videoClip':None,'videoThumbnail':None}
    return {'schemaVersion':1,'id':id,'title':title,'mapUuid':map_uuid,'agentUuid':agent_uuid,'abilitySlot':slot,'side':'attack','site':'B','start':{'x':0.6919,'y':0.7016},'end':{'x':0.3441,'y':0.8831},'bounces':[],'throwType':'normal','difficulty':'medium','tags':['synthetic','practice'],'notes':'Synthetic fixture, not a real gameplay lineup.','author':'Fixture Generator','source':'synthetic','isFavorite':True,'createdAt':'2025-01-02T03:04:05Z','updatedAt':'2025-01-03T03:04:05Z','attributes':attrs,'steps':[{'order':1,'text':'Stand on the marker','imageRef':'media/asset_fffffff.jpg'},{'order':2,'text':'Align the crosshair','imageRef':'media/asset_bbbbbbb.jpg'}],'media':media,'futureRootField':{'keep':True}}
ABYSS='224b0a95-48b9-f703-1bd8-67aca101a61f'; CORRODE='1c18ab1f-420d-0d8b-71d0-77ad3c439115'; SOVA='00000000-0000-4000-8000-00000000050a'
a=lineup('custom-abyss-mid-bend-b-site',ABYSS,SOVA,'Ability1','Mid Bend -> B Site')
c=lineup('custom-corrode-b-main',CORRODE,SOVA,'Grenade','Corrode B Main Recon',{'bounces':'2','chargeStage':'1'})
c['attributes']['slotCircles']['aim1']=[copy.deepcopy(CIRCLE)]
c['attributes']['projectiles'][0]['focusCircles']=[copy.deepcopy(CIRCLE)]
d=lineup('synthetic-double-shock',CORRODE,SOVA,'Ability1','Double shock follow-up',double=True)
d['attributes']['projectiles'][1]['focusCircles']=[{'id':'projectile-only','color':'yellow','x':0.4,'y':0.45,'radius':0.02,'showZoom':False,'zoomScale':3.5,'zoomSize':0.24,'zoomX':0.1,'zoomY':0.1}]
manifest={'formatVersion':1,'packId':'synthetic-pack-001','name':'Synthetic legacy compatibility pack','author':'LineupLab tests','createdAt':'2025-01-01T00:00:00Z','description':'Generated fixtures only; the user real pack was not present.','isSeedPlaceholder':False}
def write_zip(name,docs,media=MEDIA,manifest=manifest,raw=None):
    with zipfile.ZipFile(OUT/name,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json',json.dumps(manifest,indent=2))
        for id,doc in docs.items(): z.writestr(f'lineups/{id}.json',json.dumps(doc,indent=2))
        for path,data in media.items(): z.writestr(path,data)
        if raw:
            for path,data in raw.items():z.writestr(path,data)
write_zip('legacy-sample.zip',{a['id']:a,c['id']:c,d['id']:d})
for name,doc in [('custom-abyss-mid-bend-b-site',a),('custom-corrode-b-main',c)]: (SAMPLES/(name+'.json')).write_text(json.dumps(doc,indent=2)+'\n')
write_zip('double-shock.zip',{d['id']:d})
write_zip('recon-bounces.zip',{c['id']:c})
m=lineup('synthetic-missing-image',ABYSS,SOVA,'Grenade','Missing landing',missing=True);write_zip('missing-image.zip',{m['id']:m})
u=lineup('synthetic-unknown-map','ffffffff-ffff-4fff-8fff-ffffffffffff','ffffffff-ffff-4fff-8fff-fffffffffff0','Grenade','Unknown map and agent');write_zip('unknown-map.zip',{u['id']:u})
write_zip('zip-slip.zip',{a['id']:a},raw={'../escape.jpg':b'no'})
write_zip('absolute-path.zip',{a['id']:a},raw={'/escape.jpg':b'no'})
write_zip('symlink.zip',{a['id']:a},raw={})
with zipfile.ZipFile(OUT/'symlink.zip','a') as z:
    info=zipfile.ZipInfo('media/asset_link.jpg');info.create_system=3;info.external_attr=(0o120777<<16);z.writestr(info,b'../../escape.jpg')
write_zip('oversized-entry.zip',{a['id']:a},media={'media/asset_big.jpg':b'x'*(64*1024*1024+1)})
write_zip('malformed-json.zip',{a['id']:a},raw={'lineups/broken.json':b'{not json'})
write_zip('seed-placeholder.zip',{a['id']:a},manifest={**manifest,'packId':'seed-001','isSeedPlaceholder':True})
write_zip('duplicate-ids.zip',{a['id']:a},raw={'lineups/second.json':json.dumps({**a,'title':'Duplicate id'})})
write_zip('unsupported-media.zip',{a['id']:a},raw={'media/asset_bad.exe':b'no'})
(OUT/'README.md').write_text('# Synthetic fixtures\n\nEvery image and UUID here is generated test data, not Riot art and not the missing user pack. PNG bytes intentionally use legacy .jpg names to exercise content sniffing. See scripts/generate_fixtures.py.\n')
print('Generated',len(list(OUT.glob('*.zip'))),'synthetic ZIP fixtures')
