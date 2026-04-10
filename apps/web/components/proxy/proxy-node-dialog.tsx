"use client";
import { useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronUp, Wifi, Link2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/lib/i18n/context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type Protocol =
  | "HTTP" | "HTTPS" | "SOCKS5" | "SOCKS5-TLS"
  | "SS" | "VMess" | "VLESS" | "Trojan" | "Snell"
  | "TUIC" | "TUICv5" | "Hysteria2" | "WireGuard" | "AnyTLS" | "SSH";

type IV = Record<string, string>;

// Map lowercase DB type strings back to Protocol display names
const TYPE_TO_PROTOCOL: Record<string, Protocol> = {
  http: "HTTP", https: "HTTPS", socks5: "SOCKS5", "socks5-tls": "SOCKS5-TLS",
  ss: "SS", vmess: "VMess", vless: "VLESS", trojan: "Trojan", snell: "Snell",
  tuic: "TUIC", tuicv5: "TUICv5", hysteria2: "Hysteria2", wireguard: "WireGuard",
  anytls: "AnyTLS", ssh: "SSH",
};

export interface ProxyNodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: { name: string; type: string; server: string; port: number; config: Record<string, unknown> }) => void;
  initialProtocol?: Protocol;
  /** When provided, dialog is in edit mode and fields are pre-filled */
  editNode?: { id: string; name: string; type: string; server: string; port: number; config: string };
}

// ─── URL Parser ───────────────────────────────────────────────────────────────
interface ParsedProxy {
  protocol: Protocol;
  server: string;
  port: string;
  name: string;
  extra: IV;
}

function parseProxyUrl(raw: string): ParsedProxy | null {
  const url = raw.trim();
  try {
    if (url.startsWith("vmess://")) {
      const b64 = url.slice(8).split("#")[0];
      const json = JSON.parse(atob(b64));
      return {
        protocol: "VMess",
        server: json.add ?? "",
        port: String(json.port ?? ""),
        name: json.ps ?? decodeURIComponent(url.split("#")[1] ?? ""),
        extra: {
          uuid: json.id ?? "",
          alterId: String(json.aid ?? "0"),
          cipher: json.scy ?? json.type ?? "auto",
          network: json.net ?? "tcp",
          wsPath: json.path ?? "/",
          wsHeaders: json.host ? `{"Host":"${json.host}"}` : "",
          tls: json.tls === "tls" ? "true" : "false",
          sni: json.sni ?? json.host ?? "",
        },
      };
    }

    if (url.startsWith("vless://")) {
      const u = new URL(url.replace("vless://", "http://"));
      const params = Object.fromEntries(u.searchParams.entries());
      return {
        protocol: "VLESS",
        server: u.hostname,
        port: u.port,
        name: decodeURIComponent(u.hash.slice(1)),
        extra: {
          uuid: u.username,
          flow: params.flow ?? "",
          network: params.type ?? "tcp",
          tls: (params.security === "tls" || params.security === "reality") ? "true" : "false",
          sni: params.sni ?? params.servername ?? "",
          skipCert: params.allowInsecure === "1" ? "true" : "false",
        },
      };
    }

    if (url.startsWith("trojan://")) {
      const u = new URL(url.replace("trojan://", "http://"));
      const params = Object.fromEntries(u.searchParams.entries());
      return {
        protocol: "Trojan",
        server: u.hostname,
        port: u.port,
        name: decodeURIComponent(u.hash.slice(1)),
        extra: {
          password: u.username,
          network: params.type ?? "tcp",
          sni: params.sni ?? params.peer ?? "",
          skipCert: params.allowInsecure === "1" ? "true" : "false",
        },
      };
    }

    if (url.startsWith("ss://")) {
      // ss://BASE64#name  or  ss://method:pass@host:port#name
      const hashIdx = url.indexOf("#");
      const name = hashIdx >= 0 ? decodeURIComponent(url.slice(hashIdx + 1)) : "";
      const main = hashIdx >= 0 ? url.slice(5, hashIdx) : url.slice(5);
      // Try @-form first
      if (main.includes("@")) {
        const u = new URL("http://" + main);
        const [method, password] = (decodeURIComponent(u.username) + ":" + decodeURIComponent(u.password)).split(":");
        return { protocol: "SS", server: u.hostname, port: u.port, name, extra: { cipher: method ?? "", password: password ?? "" } };
      }
      // Legacy base64 form
      const decoded = atob(main);
      const atIdx = decoded.lastIndexOf("@");
      const creds = decoded.slice(0, atIdx);
      const hostPort = decoded.slice(atIdx + 1);
      const colonIdx = creds.indexOf(":");
      const [method, password] = [creds.slice(0, colonIdx), creds.slice(colonIdx + 1)];
      const lastColon = hostPort.lastIndexOf(":");
      const server = hostPort.slice(0, lastColon);
      const port = hostPort.slice(lastColon + 1);
      return { protocol: "SS", server, port, name, extra: { cipher: method, password } };
    }

    if (url.startsWith("hysteria2://") || url.startsWith("hy2://")) {
      const u = new URL(url.replace("hy2://", "http://").replace("hysteria2://", "http://"));
      const params = Object.fromEntries(u.searchParams.entries());
      return {
        protocol: "Hysteria2",
        server: u.hostname,
        port: u.port,
        name: decodeURIComponent(u.hash.slice(1)),
        extra: {
          password: u.username,
          sni: params.sni ?? "",
          skipCert: params.insecure === "1" ? "true" : "false",
          obfs: params.obfs ?? "",
          obfsPassword: params["obfs-password"] ?? "",
          up: params.up ?? "",
          down: params.down ?? "",
        },
      };
    }

    if (url.startsWith("tuic://")) {
      const u = new URL(url.replace("tuic://", "http://"));
      const params = Object.fromEntries(u.searchParams.entries());
      return {
        protocol: "TUIC",
        server: u.hostname,
        port: u.port,
        name: decodeURIComponent(u.hash.slice(1)),
        extra: {
          uuid: u.username,
          password: u.password,
          congestion: params.congestion_control ?? "bbr",
          alpn: params.alpn ?? "h3",
          sni: params.sni ?? "",
          skipCert: params.allow_insecure === "1" ? "true" : "false",
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Protocol groups ──────────────────────────────────────────────────────────
const PROTOCOL_GROUPS_DATA: { key: "groupClassic" | "groupEncrypted" | "groupModern"; protocols: Protocol[] }[] = [
  { key: "groupClassic", protocols: ["HTTP", "HTTPS", "SOCKS5", "SOCKS5-TLS", "SSH"] },
  { key: "groupEncrypted", protocols: ["SS", "VMess", "VLESS", "Trojan", "Snell"] },
  { key: "groupModern", protocols: ["TUIC", "TUICv5", "Hysteria2", "WireGuard", "AnyTLS"] },
];

const SS_CIPHERS = ["aes-128-gcm", "aes-256-gcm", "chacha20-ietf-poly1305", "2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm"];
const VMESS_CIPHERS = ["auto", "aes-128-gcm", "chacha20-poly1305", "none"];
const NETWORKS = ["tcp", "ws", "h2", "grpc"];
const CONGESTION = ["cubic", "bbr", "new_reno"];
const UDP_RELAY_MODES = ["native", "quic"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Password"} className="pr-9" />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function TLSOptions({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [sni, setSni] = useState(iv.sni ?? "");
  const [skipCert, setSkipCert] = useState(iv.skipCert === "true");
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[12px] border border-[var(--border)] overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-[var(--foreground)] bg-[var(--surface-2)] hover:bg-[var(--surface)] transition-colors">
        <span>{pT.tlsOptions}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-[var(--muted)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />}
      </button>
      {open && (
        <div className="px-3 pt-3 pb-3 space-y-3 bg-[var(--surface)]">
          <Field label={pT.sni}><Input value={sni} onChange={(e) => setSni(e.target.value)} placeholder="e.g. example.com" /></Field>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--foreground)]">{pT.skipCertVerify}</span>
            <Switch checked={skipCert} onCheckedChange={setSkipCert} />
          </label>
        </div>
      )}
    </div>
  );
}

function HttpFields({ tls, iv = {} }: { tls: boolean; iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [username, setUsername] = useState(iv.username ?? "");
  const [password, setPassword] = useState(iv.password ?? "");
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.username}><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" /></Field>
        <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      </div>
      {tls && <TLSOptions iv={iv} />}
    </>
  );
}

function Socks5Fields({ tls, iv = {} }: { tls: boolean; iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [username, setUsername] = useState(iv.username ?? "");
  const [password, setPassword] = useState(iv.password ?? "");
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.username}><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" /></Field>
        <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      </div>
      {tls && <TLSOptions iv={iv} />}
    </>
  );
}

function SSFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [cipher, setCipher] = useState(iv.cipher && SS_CIPHERS.includes(iv.cipher) ? iv.cipher : SS_CIPHERS[0]);
  const [password, setPassword] = useState(iv.password ?? "");
  const [plugin, setPlugin] = useState("__none__");
  const [pluginOpts, setPluginOpts] = useState("");
  return (
    <>
      <Field label={pT.cipher}>
        <Select value={cipher} onValueChange={setCipher}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{SS_CIPHERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      <Field label={pT.pluginOptional}>
        <Select value={plugin} onValueChange={setPlugin}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            <SelectItem value="obfs">obfs</SelectItem>
            <SelectItem value="v2ray-plugin">v2ray-plugin</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {plugin !== "__none__" && <Field label={pT.pluginOptions}><Input value={pluginOpts} onChange={(e) => setPluginOpts(e.target.value)} placeholder='e.g. obfs=http;obfs-host=bing.com' className="font-mono text-xs" /></Field>}
    </>
  );
}

function VMessFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [uuid, setUuid] = useState(iv.uuid ?? "");
  const [alterId, setAlterId] = useState(iv.alterId ?? "0");
  const [cipher, setCipher] = useState(iv.cipher && VMESS_CIPHERS.includes(iv.cipher) ? iv.cipher : "auto");
  const [network, setNetwork] = useState(iv.network && NETWORKS.includes(iv.network) ? iv.network : "tcp");
  const [tls, setTls] = useState(iv.tls === "true");
  const [wsPath, setWsPath] = useState(iv.wsPath ?? "/");
  const [wsHeaders, setWsHeaders] = useState(iv.wsHeaders ?? "");
  return (
    <>
      <Field label={pT.uuid}><Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.alterId}><Input type="number" value={alterId} onChange={(e) => setAlterId(e.target.value)} /></Field>
        <Field label={pT.cipher}>
          <Select value={cipher} onValueChange={setCipher}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VMESS_CIPHERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.network}>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="TLS">
          <div className="flex items-center h-9">
            <Switch checked={tls} onCheckedChange={setTls} />
            <span className="ml-2 text-sm text-[var(--muted)]">{tls ? pT.tlsEnabled : pT.tlsDisabled}</span>
          </div>
        </Field>
      </div>
      {network === "ws" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={pT.wsPath}><Input value={wsPath} onChange={(e) => setWsPath(e.target.value)} placeholder="/" className="font-mono" /></Field>
          <Field label={pT.wsHeaders}><Input value={wsHeaders} onChange={(e) => setWsHeaders(e.target.value)} placeholder='{"Host":"example.com"}' className="font-mono text-xs" /></Field>
        </div>
      )}
      {tls && <TLSOptions iv={iv} />}
    </>
  );
}

function VLESSFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [uuid, setUuid] = useState(iv.uuid ?? "");
  const [flow, setFlow] = useState(iv.flow || "__none__");
  const [network, setNetwork] = useState(iv.network && NETWORKS.includes(iv.network) ? iv.network : "tcp");
  const [tls, setTls] = useState(iv.tls === "true");
  return (
    <>
      <Field label={pT.uuid}><Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.flow}>
          <Select value={flow} onValueChange={setFlow}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={pT.network}>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-[var(--foreground)]">TLS</span>
        <Switch checked={tls} onCheckedChange={setTls} />
      </label>
      {tls && <TLSOptions iv={iv} />}
    </>
  );
}

function TrojanFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [password, setPassword] = useState(iv.password ?? "");
  const [network, setNetwork] = useState(iv.network && NETWORKS.includes(iv.network) ? iv.network : "tcp");
  return (
    <>
      <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      <Field label={pT.network}>
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <TLSOptions iv={iv} />
    </>
  );
}

function SnellFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [psk, setPsk] = useState(iv.psk ?? "");
  const [version, setVersion] = useState(iv.version ?? "3");
  const [obfs, setObfs] = useState(iv.obfs ?? "simple");
  const [obfsHost, setObfsHost] = useState(iv.obfsHost ?? "");
  return (
    <>
      <Field label={pT.psk}><PasswordInput value={psk} onChange={setPsk} placeholder="Pre-shared key" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.version}>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">v1</SelectItem>
              <SelectItem value="2">v2</SelectItem>
              <SelectItem value="3">v3</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={pT.obfs}>
          <Select value={obfs} onValueChange={setObfs}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">simple</SelectItem>
              <SelectItem value="tls">tls</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {obfs === "tls" && <Field label={pT.obfsHost}><Input value={obfsHost} onChange={(e) => setObfsHost(e.target.value)} placeholder="e.g. bing.com" /></Field>}
    </>
  );
}

function TuicFields({ v5, iv = {} }: { v5?: boolean; iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [uuid, setUuid] = useState(iv.uuid ?? "");
  const [password, setPassword] = useState(iv.password ?? "");
  const [congestion, setCongestion] = useState(iv.congestion ?? "bbr");
  const [udpRelay, setUdpRelay] = useState(iv.udpRelay ?? "native");
  const [alpn, setAlpn] = useState(iv.alpn ?? "h3");
  return (
    <>
      <Field label={pT.uuid}><Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" /></Field>
      <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.congestion}>
          <Select value={congestion} onValueChange={setCongestion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONGESTION.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        {v5 ? (
          <Field label={pT.alpn}><Input value={alpn} onChange={(e) => setAlpn(e.target.value)} placeholder="h3" className="font-mono" /></Field>
        ) : (
          <Field label={pT.udpRelayMode}>
            <Select value={udpRelay} onValueChange={setUdpRelay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UDP_RELAY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <TLSOptions iv={iv} />
    </>
  );
}

function Hysteria2Fields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [password, setPassword] = useState(iv.password ?? "");
  const [obfs, setObfs] = useState(iv.obfs || "__none__");
  const [obfsPassword, setObfsPassword] = useState(iv.obfsPassword ?? "");
  const [up, setUp] = useState(iv.up ?? "");
  const [down, setDown] = useState(iv.down ?? "");
  return (
    <>
      <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.upBandwidth}><Input type="number" value={up} onChange={(e) => setUp(e.target.value)} placeholder="e.g. 100" /></Field>
        <Field label={pT.downBandwidth}><Input type="number" value={down} onChange={(e) => setDown(e.target.value)} placeholder="e.g. 200" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={pT.obfsType}>
          <Select value={obfs} onValueChange={setObfs}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="salamander">salamander</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {obfs === "salamander" && <Field label={pT.obfsPassword}><PasswordInput value={obfsPassword} onChange={setObfsPassword} placeholder="Obfs password" /></Field>}
      </div>
      <TLSOptions iv={iv} />
    </>
  );
}

function WireGuardFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [ip, setIp] = useState(iv.ip ?? "");
  const [privateKey, setPrivateKey] = useState(iv.privateKey ?? "");
  const [publicKey, setPublicKey] = useState(iv.publicKey ?? "");
  const [presharedKey, setPresharedKey] = useState(iv.presharedKey ?? "");
  const [dns, setDns] = useState(iv.dns ?? "");
  const [mtu, setMtu] = useState(iv.mtu ?? "1420");
  const [reserved, setReserved] = useState(iv.reserved ?? "");
  return (
    <>
      <Field label={pT.interfaceIp}><Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.2/32" className="font-mono" /></Field>
      <Field label={pT.privateKey}><PasswordInput value={privateKey} onChange={setPrivateKey} placeholder="Base64 private key" /></Field>
      <Field label={pT.publicKey}><Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="Base64 public key" className="font-mono text-xs" /></Field>
      <Field label={pT.presharedKey}><PasswordInput value={presharedKey} onChange={setPresharedKey} placeholder="Optional" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="DNS"><Input value={dns} onChange={(e) => setDns(e.target.value)} placeholder="1.1.1.1" className="font-mono" /></Field>
        <Field label={pT.mtu}><Input type="number" value={mtu} onChange={(e) => setMtu(e.target.value)} /></Field>
      </div>
      <Field label={pT.reserved}><Input value={reserved} onChange={(e) => setReserved(e.target.value)} placeholder="e.g. 0,0,0" className="font-mono text-xs" /></Field>
    </>
  );
}

function AnyTLSFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [password, setPassword] = useState(iv.password ?? "");
  return (
    <>
      <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      <TLSOptions iv={iv} />
    </>
  );
}

function SSHFields({ iv = {} }: { iv?: IV }) {
  const { t } = useLocale();
  const pT = t.proxyNode;
  const [username, setUsername] = useState(iv.username ?? "");
  const [password, setPassword] = useState(iv.password ?? "");
  const [privateKey, setPrivateKey] = useState(iv.privateKey ?? "");
  const [hostKey, setHostKey] = useState(iv.hostKey ?? "");
  const [useKey, setUseKey] = useState(false);
  return (
    <>
      <Field label={pT.username}><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" /></Field>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-[var(--foreground)]">{pT.usePrivateKey}</span>
        <Switch checked={useKey} onCheckedChange={setUseKey} />
      </label>
      {useKey ? (
        <Field label={`${pT.privateKey} (PEM)`}>
          <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={4}
            className={cn("w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]", "px-3 py-2 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]", "focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent resize-none transition-all duration-150")} />
        </Field>
      ) : (
        <Field label={pT.password}><PasswordInput value={password} onChange={setPassword} /></Field>
      )}
      <Field label="Host Key (optional)"><Input value={hostKey} onChange={(e) => setHostKey(e.target.value)} placeholder="e.g. ssh-rsa AAAA..." className="font-mono text-xs" /></Field>
    </>
  );
}

function ProtocolFields({ protocol, iv, fieldKey }: { protocol: Protocol; iv: IV; fieldKey: number }) {
  const props = { iv, key: fieldKey };
  switch (protocol) {
    case "HTTP":       return <HttpFields tls={false} {...props} />;
    case "HTTPS":      return <HttpFields tls={true} {...props} />;
    case "SOCKS5":     return <Socks5Fields tls={false} {...props} />;
    case "SOCKS5-TLS": return <Socks5Fields tls={true} {...props} />;
    case "SS":         return <SSFields {...props} />;
    case "VMess":      return <VMessFields {...props} />;
    case "VLESS":      return <VLESSFields {...props} />;
    case "Trojan":     return <TrojanFields {...props} />;
    case "Snell":      return <SnellFields {...props} />;
    case "TUIC":       return <TuicFields v5={false} {...props} />;
    case "TUICv5":     return <TuicFields v5={true} {...props} />;
    case "Hysteria2":  return <Hysteria2Fields {...props} />;
    case "WireGuard":  return <WireGuardFields {...props} />;
    case "AnyTLS":     return <AnyTLSFields {...props} />;
    case "SSH":        return <SSHFields {...props} />;
    default: return null;
  }
}

// ─── Dialog ────────────────────────────────────────────────────────────────────
export function ProxyNodeDialog({ open, onClose, onSave, initialProtocol = "VMess", editNode }: ProxyNodeDialogProps) {
  const { t } = useLocale();
  const pT = t.proxyNode;

  // Resolve initial values from editNode (edit mode) or defaults (create mode)
  const initProtocol: Protocol = editNode
    ? (TYPE_TO_PROTOCOL[editNode.type] ?? "VMess")
    : initialProtocol;
  const initConfig = editNode ? (() => { try { return JSON.parse(editNode.config) as Record<string, string>; } catch { return {}; } })() : {};

  const [protocol, setProtocol] = useState<Protocol>(initProtocol);
  const [name, setName] = useState(editNode?.name ?? "");
  const [server, setServer] = useState(editNode?.server ?? "");
  const [port, setPort] = useState(editNode ? String(editNode.port) : "");
  const [udp, setUdp] = useState(Boolean(initConfig.udp));
  const [tfo, setTfo] = useState(Boolean(initConfig.tfo));
  const [remarks, setRemarks] = useState(initConfig.remarks ?? "");
  const [testing, setTesting] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [iv, setIv] = useState<IV>(initConfig);
  const [fieldKey, setFieldKey] = useState(0);

  function handlePaste(raw: string) {
    setPasteUrl(raw);
    if (!raw.trim()) return;
    const parsed = parseProxyUrl(raw.trim());
    if (!parsed) {
      toast.error(pT.parseFailed);
      return;
    }
    setProtocol(parsed.protocol);
    setServer(parsed.server);
    setPort(parsed.port);
    if (parsed.name) setName(parsed.name);
    setIv(parsed.extra);
    setFieldKey((k) => k + 1); // force sub-component remount with new initialValues
    toast.success(pT.parsedFrom);
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch('/api/mihomo/tcpping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server: server.trim(), port: parseInt(port, 10), timeout: 5000 }),
      });
      const data = await res.json() as { ok: boolean; latencyMs?: number; error?: string };
      if (data.ok) {
        toast.success(`${server}:${port} — ${data.latencyMs}ms`);
      } else {
        toast.error(`${server}:${port} — ${data.error ?? 'unreachable'}`);
      }
    } catch {
      toast.error(`${server}:${port} — unreachable`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editNode ? pT.titleEdit : pT.title}</DialogTitle>
          <DialogDescription>{pT.description}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-5">
          {/* URL paste area */}
          <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            <input
              value={pasteUrl}
              onChange={(e) => handlePaste(e.target.value)}
              placeholder={pT.pasteUrlPlaceholder}
              className="flex-1 bg-transparent text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none font-mono"
            />
          </div>

          {/* Protocol selector */}
          <div className="space-y-2">
            {PROTOCOL_GROUPS_DATA.map((group) => (
              <div key={group.key}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">{pT[group.key]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.protocols.map((p) => (
                    <button key={p} onClick={() => setProtocol(p)}
                      className={cn("rounded-[8px] px-3 py-1 text-xs font-semibold transition-all duration-150 border",
                        protocol === p
                          ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)] shadow-sm"
                          : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--brand-300)]"
                      )}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-[var(--border)]" />

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label={pT.server}><Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="e.g. proxy.example.com" /></Field>
            <Field label={pT.port}><Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" /></Field>
          </div>

          <ProtocolFields protocol={protocol} iv={iv} fieldKey={fieldKey} />

          <div className="h-px bg-[var(--border)]" />

          <Field label={pT.nodeName}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={pT.nodeNamePlaceholder} />
          </Field>

          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)]">
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">{pT.udpRelay}</span>
                <p className="text-xs text-[var(--muted)]">{pT.udpRelayDesc}</p>
              </div>
              <Switch checked={udp} onCheckedChange={setUdp} />
            </label>
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">{pT.tcpFastOpen}</span>
                <p className="text-xs text-[var(--muted)]">{pT.tcpFastOpenDesc}</p>
              </div>
              <Switch checked={tfo} onCheckedChange={setTfo} />
            </label>
          </div>

          <Field label={pT.remarks}>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={pT.remarksPlaceholder} rows={2}
              className={cn("w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]", "px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]", "focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent resize-none transition-all duration-150")} />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleTest} disabled={!server || !port || testing} className="mr-auto gap-1.5">
            <Wifi className="h-3.5 w-3.5" />
            {testing ? pT.testing : pT.testConnection}
          </Button>
          <Button variant="secondary" onClick={onClose}>{pT.cancel}</Button>
          <Button onClick={() => { onSave?.({ name: name.trim(), type: protocol.toLowerCase(), server: server.trim(), port: parseInt(port, 10), config: { udp, tfo, remarks } }); onClose(); }} disabled={!name.trim() || !server.trim() || !port}>
            {editNode ? pT.saveChanges : pT.saveNode}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
