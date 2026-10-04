# Каждое утро: если на сегодня (по Москве) курс ещё не поставлен вручную (Automost),
# ставит курс ЦБ + надбавка и обновляет дату на сайте.
import json, re, sys, os, urllib.request, datetime
DRY = os.environ.get("DRY") == "true"
MSK = datetime.timezone(datetime.timedelta(hours=3))
today = datetime.datetime.now(MSK).date().isoformat()
s = open("data.js", encoding="utf-8").read()
m = re.search(r"(/\*DATA-START\*/const DATA = )(.*?)(;/\*DATA-END\*/)", s, re.S)
if not m: sys.exit("DATA block not found")
data = json.loads(m.group(2))
if data.get("rateDate") == today and not DRY:
    print(f"::notice::rate already set for {today}"); sys.exit(0)
req = urllib.request.Request("https://www.cbr-xml-daily.ru/daily_json.js", headers={"User-Agent": "Mozilla/5.0"})
cbr = json.load(urllib.request.urlopen(req, timeout=30))["Valute"]["USD"]["Value"]
if not 50 < cbr < 200: sys.exit(f"bad CBR value {cbr}")
markup = float(data.get("rubMarkup") or 1.65)
if DRY: print(f"::notice::DRY: CBR {cbr} + {markup} = {round(cbr + markup, 2)}"); sys.exit(0)
data["rate"] = round(cbr + markup, 2)
data["rateDate"] = today
data["rateSource"] = "cbr"
data["updated"] = datetime.datetime.now(MSK).replace(microsecond=0).isoformat()
s = s[:m.start(2)] + json.dumps(data, ensure_ascii=False, indent=1) + s[m.end(2):]
open("data.js", "w", encoding="utf-8").write(s)
print(f"::notice::{today}: CBR {cbr} + {markup} = {data['rate']}")
