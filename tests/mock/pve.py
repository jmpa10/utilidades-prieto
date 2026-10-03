#!/usr/bin/env python3
"""Proxmox simulado para las pruebas: implementa lo justo de pveum, pvesh y pveversion.
El estado vive en el JSON indicado por $PVE_STATE."""
import json, os, sys

cmd = os.path.basename(sys.argv[0])
args = sys.argv[1:]
ruta_estado = os.environ["PVE_STATE"]
with open(ruta_estado) as f:
    S = json.load(f)

def guardar():
    with open(ruta_estado, "w") as f:
        json.dump(S, f, indent=1)

def fallo(msg):
    print(msg, file=sys.stderr)
    sys.exit(255)

def opts(lista):
    o, pos, i = {}, [], 0
    while i < len(lista):
        if lista[i].startswith("--"):
            o[lista[i][2:]] = lista[i + 1] if i + 1 < len(lista) else ""
            i += 2
        else:
            pos.append(lista[i]); i += 1
    return pos, o

def out(d):
    print(json.dumps(d))

def miembros(pid):
    m = [dict(type="storage", storage=s, node="pve1", id="storage/pve1/" + s) for s in S["pools"][pid].get("storage", [])]
    for vid, vm in S["vms"].items():
        if vm.get("pool") == pid:
            t, n = vid.split("/")
            m.append(dict(type=t, vmid=int(n), node=vm["node"], id=vid))
    return m

S.setdefault("log", []).append(" ".join([cmd] + args))

if cmd == "pveversion":
    print("pve-manager/" + S.get("version", "8.2.4") + "/abcdef (running kernel: 6.8.12-1-pve)")

elif cmd == "pveum":
    obj, accion, *resto = args
    pos, o = opts(resto)
    if accion == "list":
        if obj == "user": out([dict(userid=u, **{k: v for k, v in d.items() if k != "password"}) for u, d in S["users"].items()])
        elif obj == "group": out([dict(groupid=g, **d) for g, d in S["groups"].items()])
        elif obj == "pool": out([dict(poolid=p, comment=d.get("comment", "")) for p, d in S["pools"].items()])
        elif obj == "role": out([dict(roleid=r) for r in S["roles"]])
        elif obj == "acl": out([dict(path=a[0], type=a[1], ugid=a[2], roleid=a[3], propagate=1) for a in S["acl"]])
    elif obj == "group" and accion == "add":
        if pos[0] in S["groups"]: fallo("group exists")
        S["groups"][pos[0]] = dict(comment=o.get("comment", ""))
    elif obj == "group" and accion == "delete":
        S["groups"].pop(pos[0])
        S["acl"] = [a for a in S["acl"] if not (a[1] == "group" and a[2] == pos[0])]
    elif obj == "pool" and accion == "add":
        p = pos[0]
        if p in S["pools"]: fallo("pool exists")
        if "/" in p and p.rsplit("/", 1)[0] not in S["pools"]: fallo("parent pool does not exist")
        S["pools"][p] = dict(comment=o.get("comment", ""), storage=[])
    elif obj == "pool" and accion == "modify":
        p = S["pools"][pos[0]]
        if o.get("delete") == "1": p["storage"].remove(o["storage"])
        elif o["storage"] not in p["storage"]: p["storage"].append(o["storage"])
    elif obj == "pool" and accion == "delete":
        p = pos[0]
        if miembros(p): fallo("pool '%s' is not empty" % p)
        if any(x.startswith(p + "/") for x in S["pools"]): fallo("pool has sub-pools")
        S["pools"].pop(p)
    elif obj == "user" and accion == "add":
        u = pos[0]
        if u in S["users"]: fallo("user exists")
        g = [x for x in o.get("groups", "").split(",") if x]
        for x in g:
            if x not in S["groups"]: fallo("group does not exist")
        S["users"][u] = dict(groups=g, comment=o.get("comment", ""), password=o.get("password"))
    elif obj == "user" and accion == "delete":
        S["users"].pop(pos[0])
        S["acl"] = [a for a in S["acl"] if not (a[1] == "user" and a[2] == pos[0])]
    elif obj == "acl" and accion in ("modify", "delete"):
        quien = ("user", o["users"]) if "users" in o else ("group", o["groups"])
        if quien[0] == "user" and quien[1] not in S["users"]: fallo("user does not exist")
        if quien[0] == "group" and quien[1] not in S["groups"]: fallo("group does not exist")
        for rol in o["roles"].split(","):
            if rol not in S["roles"]: fallo("role '%s' does not exist" % rol)
            a = [pos[0], quien[0], quien[1], rol]
            if accion == "modify" and a not in S["acl"]: S["acl"].append(a)
            if accion == "delete" and a in S["acl"]: S["acl"].remove(a)
    elif obj == "role" and accion in ("add", "modify"):
        r = pos[0]
        if accion == "add" and r in S["roles"]: fallo("role exists")
        if accion == "modify" and r not in S["roles"]: fallo("role does not exist")
        if r not in S["roles"]: S["roles"].append(r)
        S.setdefault("privs", {})[r] = o.get("privs", "")
    else:
        fallo("pveum simulado: no implementado " + " ".join(args))

elif cmd == "pvesh":
    metodo, ruta, *resto = args
    pos, o = opts(resto)
    partes = ruta.strip("/").split("/")
    if metodo == "get" and partes[0] == "storage":
        if partes[1] not in S["storages"]: fallo("storage does not exist")
        out(dict(storage=partes[1]))
    elif metodo == "get" and ruta == "/pools":
        if "poolid" in o:
            if o["poolid"] not in S["pools"]: fallo("pool does not exist")
            out([dict(poolid=o["poolid"], members=miembros(o["poolid"]))])
        else:
            out([dict(poolid=p, comment=d.get("comment", "")) for p, d in S["pools"].items()])
    elif metodo == "get" and partes[0] == "access":
        out(dict(members=[u for u, d in S["users"].items() if partes[2] in d["groups"]]))
    elif metodo == "get" and partes[0] == "nodes" and len(partes) == 4 and partes[2] == "network":
        if partes[3] not in S.get("bridges", []): fallo("interface does not exist")
        out(dict(iface=partes[3], type="bridge"))
    elif metodo == "get" and partes[0] == "nodes" and partes[-1] == "config":
        out(S["vms"][partes[2] + "/" + partes[3]]["config"])
    elif metodo == "create" and partes[-1] == "stop":
        S["vms"][partes[2] + "/" + partes[3]]["status"] = "stopped"
        print("UPID:pve1:stop")
    elif metodo == "delete" and partes[0] == "nodes":
        vid = partes[2] + "/" + partes[3]
        if S["vms"][vid].get("status") != "stopped": fallo("VM is running")
        S["vms"].pop(vid)
    else:
        fallo("pvesh simulado: no implementado " + " ".join(args))

guardar()
