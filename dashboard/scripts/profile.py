import csv, sys, os, json
csv.field_size_limit(10**9)
root=sys.argv[1]
out=[]
for dp,_,fs in os.walk(root):
    for f in sorted(fs):
        p=os.path.join(dp,f); rel=os.path.relpath(p,root)
        if not f.endswith('.csv'):
            out.append({'file':rel,'size':os.path.getsize(p),'type':'other'}); continue
        try:
            with open(p,newline='',encoding='utf-8',errors='replace') as fh:
                r=csv.reader(fh); hdr=next(r,[]); n=0; sample=[]
                for row in r:
                    n+=1
                    if len(sample)<2: sample.append([c[:60] for c in row])
            out.append({'file':rel,'size':os.path.getsize(p),'rows':n,'cols':hdr,'sample':sample})
        except Exception as e:
            out.append({'file':rel,'err':str(e)})
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
for o in out:
    print(o['file'], o.get('size'), 'rows=',o.get('rows'), 'cols=',(o.get('cols') or [])[:15])
