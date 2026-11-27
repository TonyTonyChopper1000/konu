import csv, os, re, json, sys, collections as C
csv.field_size_limit(10**9)
D=sys.argv[1]; O=sys.argv[2]
def rd(p): return list(csv.DictReader(open(p,encoding='utf-8-sig',errors='replace',newline='')))
def wr(name, rows, cols):
    with open(os.path.join(O,name),'w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,cols); w.writeheader(); w.writerows(rows)
prof=json.load(open(sys.argv[3]))
SRC={'bhubharati-csv':'Bhubharati','hmda-csv':'HMDA','sites-csv':'Govt websites','tgrac-csv':'TGRAC GIS'}
inv=[]
for o in prof:
    f=o['file']
    if not f.endswith('.csv'): continue
    top=f.split('/')[0]; rest=f.split('output/',1)[1]
    parts=rest.split('/')
    if top=='tgrac-csv':
        section = parts[1] if parts[0]=='data' else 'Catalogue'
        section = section.replace('_Folder','')
    elif top=='sites-csv': section = parts[0]
    elif top=='hmda-csv': section = 'Website' if parts[0]=='site' else ('PDF index' if parts[0]=='pdfs' else 'Registers')
    else: section='Land records'
    kind = 'Scraped table' if '/tables/' in f else 'Dataset'
    inv.append({'source':SRC[top],'section':section,'kind':kind,'file':rest.split('/')[-1],'path':rest,
        'records':o.get('rows',0),'columns':len(o.get('cols') or []),
        'column_names':'; '.join(c.strip('﻿"') for c in (o.get('cols') or []))[:300],'size_kb':round(o['size']/1024,1)})
wr('inventory.csv',inv,list(inv[0].keys()))

# Bhubharati per district
b=os.path.join(D,'bhubharati-csv/bhubharati-crawler/output/')
dist={r['district_name']:{'district':r['district_name'],'district_te':r['district_name_te'],'mandals':0,'villages':0,'survey_numbers':0,'sro_offices':0} for r in rd(b+'districts.csv')}
for fn,k in [('mandals.csv','mandals'),('villages.csv','villages'),('sro_offices.csv','sro_offices')]:
    for r in rd(b+fn): dist.setdefault(r['district_name'],{'district':r['district_name'],'district_te':'','mandals':0,'villages':0,'survey_numbers':0,'sro_offices':0})[k]+=1
with open(b+'survey_numbers.csv',encoding='utf-8-sig',newline='') as fh:
    for r in csv.DictReader(fh): dist[r['district_name']]['survey_numbers']+=1
wr('bhu_districts.csv',sorted(dist.values(),key=lambda x:-x['survey_numbers']),['district','district_te','mandals','villages','survey_numbers','sro_offices'])

# HMDA registers + by year
h=os.path.join(D,'hmda-csv/hmda-crawler/output/')
REG=[('building_permissions.csv','Building permissions','Released on'),('layout_permissions.csv','Layout permissions','Draft_layout_issued'),
('single_window.csv','Single-window industrial permissions','Released on'),('municipal.csv','Land-use change (municipal)','Memo_Go_Issued'),
('nocs.csv','NOCs','Year'),('extended_area_layouts.csv','Extended-area layouts','Draft_layout_issued'),('extended_area_nocs.csv','Extended-area NOCs','Released On'),
('extended_area_building_permissions.csv','Extended-area building permissions','Released on'),('hada_layouts.csv','HADA layouts','Draft_layout_issued'),('hada_building_permissions.csv','HADA building permissions','Released on')]
regs=[]; yr=C.Counter()
for fn,name,dc in REG:
    rows=rd(h+fn); ys=[]
    for r in rows:
        v=r.get(dc,'') or ''
        m=re.findall(r'(19[89]\d|20[0-2]\d)',v)
        if m: ys.append(int(m[-1])); yr[(int(m[-1]),name)]+=1
    regs.append({'register':name,'file':fn,'records':len(rows),'with_date':len(ys),'first_year':min(ys) if ys else '','last_year':max(ys) if ys else '','date_field':dc})
wr('hmda_registers.csv',regs,list(regs[0].keys()))
main={'Building permissions','Layout permissions','Single-window industrial permissions'}
yrows=[]
for y in range(min(k[0] for k in yr),2027):
    row={'year':str(y)}
    for n in ['Building permissions','Layout permissions','Single-window industrial permissions']: row[n]=yr.get((y,n),0)
    if sum(row[n] for n in main): yrows.append(row)
wr('hmda_by_year.csv',yrows,['year','Building permissions','Layout permissions','Single-window industrial permissions'])

# TGRAC catalogue by folder
t=os.path.join(D,'tgrac-csv/tgrac-crawler/output/')
cat=rd(t+'catalogue.csv')
down=set()
for dp,_,fs in os.walk(t+'data'):
    for f in fs:
        rel=os.path.relpath(os.path.join(dp,f),t+'data').split('/')
        down.add((rel[0],rel[1],f.split('_')[0]))
fold={}
for r in cat:
    k=r['folder'] or '(root)'
    x=fold.setdefault(k,{'folder':k.replace('_Folder',''),'services':set(),'layers':0,'feature_layers':0,'raster_layers':0,'records':0,'downloaded_layers':0,'downloaded_records':0})
    x['services'].add(r['service']); x['layers']+=1
    if r['layer_type']=='Feature Layer': x['feature_layers']+=1
    if r['layer_type']=='Raster Layer': x['raster_layers']+=1
    n=int(r['records']) if r['records'].isdigit() else 0
    x['records']+=n
    svc=r['service'].split('/')[-1]
    if (r['folder'],svc,r['layer_id']) in down: x['downloaded_layers']+=1; x['downloaded_records']+=n
for x in fold.values(): x['services']=len(x['services'])
fr=sorted(fold.values(),key=lambda x:-x['records'])
wr('tgrac_folders.csv',fr,list(fr[0].keys()))
geo=C.Counter((r['geometry'].replace('esriGeometry','') or 'None (raster/group/table)') for r in cat)
wr('tgrac_geometry.csv',[{'geometry':k,'layers':v} for k,v in geo.most_common()],['geometry','layers'])

# Sites
s=os.path.join(D,'sites-csv/sites-crawler/output/')
NAMES={'rera':'TG RERA','cgwb':'CGWB (groundwater board)','ghmc':'GHMC','tgrac':'TGRAC','tgbpass':'TG-bPASS','meeseva_faq':'MeeSeva FAQ'}
sr=[]
for k in sorted(os.listdir(s)):
    def n(fn):
        p=s+k+'/'+fn; return len(rd(p)) if os.path.exists(p) else 0
    docs=rd(s+k+'/documents.csv') if os.path.exists(s+k+'/documents.csv') else []
    types=C.Counter((d['type'] or 'other').lower() for d in docs)
    sr.append({'site':NAMES.get(k,k),'pages':n('pages.csv'),'documents':len(docs),'tables':n('tables.csv'),'skipped_pages':n('skipped_pages.csv'),'download_failures':n('download_failures.csv'),'top_doc_types':', '.join(f'{a} ({b})' for a,b in types.most_common(3))})
hs=h+'site/'
docs=rd(hs+'documents.csv'); types=C.Counter((d['type'] or 'other').lower() for d in docs)
sr.append({'site':'HMDA website','pages':len(rd(hs+'pages.csv')),'documents':len(docs),'tables':len(rd(hs+'tables.csv')),'skipped_pages':0,'download_failures':len(rd(hs+'download_failures.csv')),'top_doc_types':', '.join(f'{a} ({b})' for a,b in types.most_common(3))})
sr.sort(key=lambda x:-x['documents'])
wr('sites.csv',sr,list(sr[0].keys()))
# RERA complaints by category
p=s+'rera/tables/586784u3y5dsgfg-TG-RERA-45678jklshihnfgsfdg-1.csv'
rc=rd(p); cc=C.Counter((r.get('Category') or 'Unspecified').strip() or 'Unspecified' for r in rc)
wr('rera_complaints.csv',[{'category':a,'complaints':b} for a,b in cc.most_common()],['category','complaints'])
print(len(inv),'inventory rows')
for f in os.listdir(O): print(f, os.path.getsize(os.path.join(O,f)))
