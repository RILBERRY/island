#!/usr/bin/env python3
"""Convert an OpenStreetMap map.json export of Laamu Atoll into the L15 world file.

Usage: python3 -I tools/build-world.py data/laamu-osm.json public/world/isdhoo.json

Local metric frame (x = east, y = height, z = south) centred on Isdhoo village. Every
closed coastline becomes an island with a landing (jetty, marina or beach) so boats can
dock; roads, buildings, pitches, places and woods are attributed to their island.
Geometry is preserved from OSM (ODbL); heights, vegetation and water styling are illustrative.
"""
import json, math, sys, datetime

src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
els = data["elements"]
nodes = {e["id"]: e for e in els if e["type"] == "node"}
ways = [e for e in els if e["type"] == "way"]

MAIN_COASTLINE = 19882790          # Isdhoo + Kalaidhoo landmass
JETTY_WAY = 150618649              # main pier at the Isdhoo harbour
ATOLL_WAY = 671807128
INHABITED = {"Isdhoo", "Dhanbidhoo", "Maabaidhoo", "Mundoo", "Kalaidhoo", "Gan", "Fonadhoo", "Maamendhoo", "Hithadhoo", "Kunahandhoo", "Maavah"}
SPECIAL = {"Kaadedhdhoo": "Airport island (Kadhdhoo)", "Olhuveli": "Resort island (Six Senses Laamu)", "Maandhoo": "Industrial island", "Gaadhoo": "Former village, turtle beach"}

origin_lat, origin_lon = 2.1265, 73.5795
phi = math.radians(origin_lat)
north_scale = 111132.954 - 559.822 * math.cos(2 * phi) + 1.175 * math.cos(4 * phi)
east_scale = (math.pi / 180) * 6378137 * math.cos(phi) / math.sqrt(1 - 0.00669438 * math.sin(phi) ** 2)

def to_xz(lat, lon):
    return ((lon - origin_lon) * east_scale, -(lat - origin_lat) * north_scale)

def way_pts(w):
    return [to_xz(nodes[n]["lat"], nodes[n]["lon"]) for n in w["nodes"] if n in nodes]

def ring(w):
    out = way_pts(w)
    if len(out) > 1 and out[0] == out[-1]:
        out = out[:-1]
    return [[round(x, 2), round(z, 2)] for x, z in out]

def centroid(poly):
    return sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)

def signed_area(poly):
    a = 0
    for i in range(len(poly)):
        x1, z1 = poly[i]; x2, z2 = poly[(i + 1) % len(poly)]
        a += x1 * z2 - x2 * z1
    return a / 2

def bbox(poly):
    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    return min(xs), max(xs), min(zs), max(zs)

def point_in_ring(x, z, pts):
    inside = False
    n = len(pts)
    for i in range(n):
        x1, z1 = pts[i]; x2, z2 = pts[(i + 1) % n]
        if (z1 > z) != (z2 > z):
            xi = x1 + (z - z1) * (x2 - x1) / (z2 - z1)
            if xi > x: inside = not inside
    return inside

def simplify(points, tol):
    if len(points) < 3: return points
    def dseg(p, a, b):
        dx, dz = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dz * dz
        t = 0 if l2 == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
        return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        md, idx = 0, -1
        for i in range(a + 1, b):
            d = dseg(points[i], points[a], points[b])
            if d > md: md, idx = d, i
        if md > tol and idx > 0:
            keep[idx] = True; stack.append((a, idx)); stack.append((idx, b))
    return [p for p, k in zip(points, keep) if k]

# ---------------- islands ----------------
islands = []
for w in ways:
    t = w.get("tags", {})
    if t.get("natural") == "coastline" and w["nodes"][0] == w["nodes"][-1]:
        r = ring(w)
        area = abs(signed_area(r))
        if area < 2500: continue
        cx, cz = centroid(r)
        name = t.get("name:en") or t.get("name") or ""
        if name and any("\u0780" <= ch <= "\u07bf" for ch in name):  # Thaana-only name; keep as nameDv
            name_dv, name = name, t.get("name:en", "")
        else:
            name_dv = t.get("name:dv", "")
        islands.append({
            "id": f"way-{w['id']}", "osmId": w["id"], "name": name or "Islet", "nameDv": name_dv,
            "main": w["id"] == MAIN_COASTLINE, "kind": t.get("place", "islet"), "areaM2": round(area),
            "x": round(cx, 2), "z": round(cz, 2), "points": r, "bbox": [round(v, 1) for v in bbox(r)],
            "inhabited": name in INHABITED, "note": SPECIAL.get(name, ""),
            "source": f"https://www.openstreetmap.org/way/{w['id']}",
        })
islands.sort(key=lambda i: -i["areaM2"])
# Kalaidhoo shares the Isdhoo landmass: the OSM "Kalaidhoo" ring here is an islet elsewhere; mark the landmass note.
for i in islands:
    if i["main"]: i["note"] = "Shares its landmass with Kalaidhoo"

def island_of(x, z):
    for i in islands:
        b = i["bbox"]
        if x < b[0] or x > b[1] or z < b[2] or z > b[3]: continue
        if point_in_ring(x, z, i["points"]): return i
    return None

def island_name_of(x, z):
    i = island_of(x, z)
    return i["name"] if i else ""

# ---------------- roads ----------------
ROAD_WIDTH = {"secondary": 8.0, "tertiary": 7.0, "residential": 6.0, "living_street": 5.0, "unclassified": 5.0, "service": 4.0, "track": 3.0, "path": 1.8, "footway": 1.8, "primary": 9.0}
roads = []
for w in ways:
    t = w.get("tags", {})
    if "highway" in t and t["highway"] in ROAD_WIDTH:
        pl = way_pts(w)
        if len(pl) < 2: continue
        mid = pl[len(pl) // 2]
        roads.append({
            "id": f"way-{w['id']}", "kind": t["highway"], "name": t.get("name", ""), "nameDv": t.get("name:dv", ""),
            "surface": t.get("surface", ""), "width": ROAD_WIDTH[t["highway"]], "island": island_name_of(*mid),
            "points": [[round(x, 2), round(z, 2)] for x, z in pl], "source": f"https://www.openstreetmap.org/way/{w['id']}",
        })

# ---------------- buildings ----------------
def estimate_height(area, tags):
    if tags.get("building") in ("school", "hospital", "hotel", "university", "college"): return 7.0
    if area > 400: return 7.0
    if area > 180: return 5.5
    return 3.6

buildings = []
addresses = []
for w in ways:
    t = w.get("tags", {})
    if "building" in t and w["nodes"][0] == w["nodes"][-1] and len(w["nodes"]) > 3:
        r = ring(w)
        area = abs(signed_area(r))
        if area < 6: continue
        cx, cz = centroid(r)
        isl = island_name_of(cx, cz)
        buildings.append({
            "id": f"way-{w['id']}", "name": t.get("name", ""), "kind": t.get("amenity") or t.get("tourism") or t.get("building"),
            "street": t.get("addr:street", ""), "city": t.get("addr:city", "") or isl, "island": isl,
            "height": estimate_height(area, t), "areaM2": round(area), "points": r, "x": round(cx, 2), "z": round(cz, 2),
            "review": "OpenStreetMap footprint · height estimated", "source": f"https://www.openstreetmap.org/way/{w['id']}",
        })
        if t.get("name") and "amenity" not in t and "tourism" not in t:
            addresses.append({
                "id": f"addr-{w['id']}", "name": t["name"], "nameDv": t.get("name:dv", ""), "category": "Address", "kind": "address",
                "icon": "address", "color": "#ef6a58", "x": round(cx, 2), "z": round(cz, 2), "latitude": nodes[w["nodes"][0]]["lat"],
                "longitude": nodes[w["nodes"][0]]["lon"], "island": isl,
                "description": f"Building on {t.get('addr:street', 'an unnamed street')}, {isl or 'Laamu'}.", "review": "OpenStreetMap · not locally verified",
            })

# ---------------- places ----------------
places = []
def add_place(pid, name, name_dv, category, icon, x, z, lat, lon, description="", source="", color="#4a806b"):
    places.append({
        "id": pid, "name": name, "nameDv": name_dv, "category": category, "icon": icon, "color": color,
        "x": round(x, 2), "z": round(z, 2), "latitude": lat, "longitude": lon, "island": island_name_of(x, z),
        "description": description, "review": "OpenStreetMap · not locally verified", "source": source, "kind": "place", "visibility": "public",
    })

CATS = [
    ("amenity", "hospital", "Community", "health", "#2f7a9a", "Health centre or hospital."),
    ("amenity", "place_of_worship", "Community", "landmark", "#4a806b", "Mosque."),
    ("amenity", "school", "Community", "landmark", "#4a806b", "School."),
    ("amenity", "university", "Community", "landmark", "#4a806b", "University campus."),
    ("amenity", "college", "Community", "landmark", "#4a806b", "College."),
    ("amenity", "kindergarten", "Community", "landmark", "#4a806b", "Preschool."),
    ("amenity", "community_centre", "Community", "landmark", "#4a806b", "Community centre."),
    ("amenity", "police", "Community", "landmark", "#4a806b", "Police."),
    ("amenity", "courthouse", "Community", "landmark", "#4a806b", "Magistrate court."),
    ("leisure", "pitch", "Community", "ball", "#4a806b", "Football ground."),
    ("leisure", "park", "Community", "ball", "#4a806b", "Park."),
    ("leisure", "marina", "Waterfront", "anchor", "#2f6f8f", "Harbour and jetty."),
    ("amenity", "ferry_terminal", "Waterfront", "anchor", "#2f6f8f", "Ferry terminal."),
    ("tourism", "hotel", "Stay", "landmark", "#8a5a9a", "Hotel or resort."),
    ("tourism", "guest_house", "Stay", "landmark", "#8a5a9a", "Guest house."),
    ("aeroway", "aerodrome", "Transport", "plane", "#555", "Domestic airport."),
]
seen = set()
for w in ways:
    t = w.get("tags", {})
    if t.get("natural") == "coastline" or "highway" in t: continue
    for key, val, cat, icon, color, desc in CATS:
        if t.get(key) == val:
            pl = way_pts(w)
            if not pl: break
            cx, cz = centroid(pl)
            name = t.get("name") or t.get("name:en")
            if not name:
                isl = island_name_of(cx, cz) or "Laamu"
                name = f"{isl} {'Football Ground' if val == 'pitch' else 'Mosque' if val == 'place_of_worship' else 'Jetty' if val == 'marina' else val.replace('_', ' ').title()}"
            if (name, round(cx / 50)) in seen: break
            seen.add((name, round(cx / 50)))
            lat, lon = nodes[w["nodes"][0]]["lat"], nodes[w["nodes"][0]]["lon"]
            add_place(f"way-{w['id']}", name, t.get("name:dv", ""), cat, icon, cx, cz, lat, lon, desc, f"https://www.openstreetmap.org/way/{w['id']}", color)
            break
for n in nodes.values():
    t = n.get("tags", {})
    if not t: continue
    for key, val, cat, icon, color, desc in CATS:
        if t.get(key) == val:
            x, z = to_xz(n["lat"], n["lon"])
            name = t.get("name:en") or t.get("name") or f"{island_name_of(x, z)} {val.replace('_', ' ').title()}"
            if (name, round(x / 50)) in seen: break
            seen.add((name, round(x / 50)))
            add_place(f"node-{n['id']}", name, t.get("name:dv", ""), cat, icon, x, z, n["lat"], n["lon"], desc, f"https://www.openstreetmap.org/node/{n['id']}", color)
            break
# Dhivehi name for the Isdhoo mosque and harbour as before
for p in places:
    if p["name"] == "Isdhoo Old Mosque": p["nameDv"] = "އިސްދޫ އާސާރީ މިސްކިތް"; p["description"] = "Historic coral-stone mosque of Isdhoo."
    if p["name"] == "L.Isdhoo Health Centre (IHC)": p["nameDv"] = "ލ. އިސްދޫ ސިއްޙީ މަރުކަޒު"; p["description"] = "Island health centre run by Gan Regional Hospital."

# Named streets as places
for r in roads:
    if r["name"] and r["island"]:
        mid = r["points"][len(r["points"]) // 2]
        places.append({"id": r["id"] + "-street", "name": r["name"], "nameDv": r["nameDv"], "category": "Street", "icon": "road", "color": "#8a6d3b",
                       "x": mid[0], "z": mid[1], "latitude": 0, "longitude": 0, "island": r["island"], "description": f"Street in {r['island']}.",
                       "review": "OpenStreetMap", "source": r["source"], "kind": "place", "visibility": "public"})

# ---------------- piers, docks, pitches, woods ----------------
piers = []
for w in ways:
    t = w.get("tags", {})
    if t.get("man_made") in ("pier", "breakwater"):
        pl = way_pts(w)
        if len(pl) < 2: continue
        piers.append({"id": f"way-{w['id']}", "kind": t["man_made"], "points": [[round(x, 2), round(z, 2)] for x, z in pl], "width": 5.0 if t["man_made"] == "pier" else 6.0, "closed": w["nodes"][0] == w["nodes"][-1]})
docks = []
for w in ways:
    t = w.get("tags", {})
    if t.get("leisure") == "marina" and w["nodes"][0] == w["nodes"][-1]:
        docks.append({"id": f"way-{w['id']}", "name": t.get("name", ""), "points": ring(w)})
pitches = []
for w in ways:
    t = w.get("tags", {})
    if t.get("leisure") == "pitch" and w["nodes"][0] == w["nodes"][-1] and len(w["nodes"]) > 3:
        pitches.append({"id": f"way-{w['id']}", "points": ring(w)})
woods = []
for w in ways:
    t = w.get("tags", {})
    if (t.get("natural") == "wood" or t.get("landuse") == "forest") and w["nodes"][0] == w["nodes"][-1] and len(w["nodes"]) > 3:
        r = simplify(ring(w), 3)
        if abs(signed_area(r)) > 300: woods.append({"id": f"way-{w['id']}", "points": r})
atoll = None
for w in ways:
    if w["id"] == ATOLL_WAY:
        atoll = [[round(x, 1), round(z, 1)] for x, z in way_pts(w)]

# ---------------- landings (where boats dock) ----------------
main_island = next(i for i in islands if i["main"])
def push(px, pz, cx, cz, dist):
    dx, dz = px - cx, pz - cz; l = math.hypot(dx, dz) or 1
    return px + dx / l * dist, pz + dz / l * dist
landings = []
for isl in islands:
    if isl["areaM2"] < 15000 and not isl["inhabited"]: continue
    cx, cz = isl["x"], isl["z"]
    cand = None
    # 1) piers attached to this island
    for p in piers:
        if p["kind"] != "pier": continue
        pts = p["points"]
        inland = min(pts, key=lambda q: math.hypot(q[0] - cx, q[1] - cz))
        sea = max(pts, key=lambda q: math.hypot(q[0] - cx, q[1] - cz))
        if island_of(*inland) is isl or (island_of(*inland) is None and min(math.hypot(q[0] - cx, q[1] - cz) for q in pts) < 600 and island_of(*push(inland[0], inland[1], cx, cz, -15)) is isl):
            wx, wz = push(sea[0], sea[1], cx, cz, 12)
            name = "Isdhoo Harbour" if p["id"] == f"way-{JETTY_WAY}" else f"{isl['name']} Jetty"
            c = {"id": f"landing-{p['id']}", "island": isl["name"], "name": name, "nameDv": isl["nameDv"], "dock": [round(inland[0], 2), round(inland[1], 2)], "water": [round(wx, 2), round(wz, 2)], "kind": "pier"}
            if isl["main"] and p["id"] == f"way-{JETTY_WAY}": cand = c; break
            if cand is None: cand = c
    # 2) marina areas
    if cand is None:
        for d in docks:
            mx, mz = centroid(d["points"])
            if math.hypot(mx - cx, mz - cz) < 1500 and (island_of(mx, mz) is isl or island_of(mx, mz) is None):
                near = min(d["points"], key=lambda q: math.hypot(q[0] - cx, q[1] - cz))
                dx, dz = push(near[0], near[1], cx, cz, -6)
                wx, wz = push(mx, mz, cx, cz, 25)
                cand = {"id": f"landing-{d['id']}", "island": isl["name"], "name": d["name"] or f"{isl['name']} Jetty", "nameDv": isl["nameDv"], "dock": [round(dx, 2), round(dz, 2)], "water": [round(wx, 2), round(wz, 2)], "kind": "marina"}
                break
    # 3) beach landing on the side facing Isdhoo
    if cand is None:
        near = min(isl["points"], key=lambda q: math.hypot(q[0] - main_island["x"], q[1] - main_island["z"]))
        dx, dz = push(near[0], near[1], cx, cz, -8)
        wx, wz = push(near[0], near[1], cx, cz, 45)
        cand = {"id": f"landing-{isl['id']}", "island": isl["name"], "name": f"{isl['name']} beach", "nameDv": isl["nameDv"], "dock": [round(dx, 2), round(dz, 2)], "water": [round(wx, 2), round(wz, 2)], "kind": "beach"}
    landings.append(cand)

jetty = next(l for l in landings if l["id"] == f"landing-way-{JETTY_WAY}")
spawn = {"x": jetty["dock"][0] - 8, "z": jetty["dock"][1]}

world = {
    "schemaVersion": 2,
    "island": {"name": "Isdhoo", "nameDv": "އިސްދޫ", "atoll": "Laamu (Haddhunmathi)", "atollCode": "L", "postcode": "15011",
               "latitude": 2.1194, "longitude": 73.5694, "timezone": "Indian/Maldives"},
    "coordinates": {"name": "WGS84 local metric frame", "origin": {"latitude": origin_lat, "longitude": origin_lon},
                    "eastScale": east_scale, "northScale": north_scale, "axes": {"x": "east", "y": "height", "z": "south"},
                    "units": "metres", "georeferenced": True},
    "spawn": spawn,
    "coastlines": islands,
    "atoll": atoll,
    "reefs": [],
    "roads": roads,
    "buildings": buildings,
    "piers": piers,
    "docks": docks,
    "pitches": pitches,
    "woods": woods,
    "landings": landings,
    "places": places,
    "addresses": addresses,
    "coverage": {"islands": len(islands), "roads": len(roads), "buildings": len(buildings), "places": len(places), "addresses": len(addresses), "landings": len(landings),
                 "locallyReviewed": False,
                 "notes": "OSM geometry is preserved across Laamu Atoll. Building coverage is incomplete. Heights, vegetation, traffic and shallow-water styling are illustrative; not cadastral or survey data."},
    "source": {"provider": "OpenStreetMap contributors", "url": f"https://www.openstreetmap.org/way/{MAIN_COASTLINE}",
               "api": "https://api.openstreetmap.org/api/0.6/map.json?bbox=73.28,1.76,73.64,2.16",
               "retrievedAt": datetime.date.today().isoformat(), "license": "ODbL-1.0", "licenseUrl": "https://www.openstreetmap.org/copyright",
               "coastlineWay": MAIN_COASTLINE},
}
json.dump(world, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"wrote {dst}: {len(islands)} islands, {len(roads)} roads, {len(buildings)} buildings, {len(places)} places, {len(landings)} landings, {len(woods)} woods, atoll {'yes' if atoll else 'no'}")
for l in landings: print(f"  landing {l['island']:<16} {l['kind']:<6} {l['name']}")
