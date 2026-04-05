"use client";
import { useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronUp, Wifi } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type Protocol =
  | "HTTP" | "HTTPS" | "SOCKS5" | "SOCKS5-TLS"
  | "SS" | "VMess" | "VLESS" | "Trojan" | "Snell"
  | "TUIC" | "TUICv5" | "Hysteria2" | "WireGuard" | "AnyTLS" | "SSH";

interface ProxyNodeDialogProps {
  open: boolean;
  onClose: () => void;
  onSave?: (data: { name: string; type: string; server: string; port: number; config: Record<string, unknown> }) => void;
  initialProtocol?: Protocol;
}

// ─── Protocol groups ──────────────────────────────────────────────────────────
const PROTOCOL_GROUPS: { label: string; protocols: Protocol[] }[] = [
  { label: "Classic", protocols: ["HTTP", "HTTPS", "SOCKS5", "SOCKS5-TLS", "SSH"] },
  { label: "Encrypted", protocols: ["SS", "VMess", "VLESS", "Trojan", "Snell"] },
  { label: "Modern", protocols: ["TUIC", "TUICv5", "Hysteria2", "WireGuard", "AnyTLS"] },
];

const ALL_PROTOCOLS: Protocol[] = PROTOCOL_GROUPS.flatMap((g) => g.protocols);

// ─── Cipher options ───────────────────────────────────────────────────────────
const SS_CIPHERS = [
  "aes-128-gcm", "aes-256-gcm", "chacha20-ietf-poly1305",
  "2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm",
];
const VMESS_CIPHERS = ["auto", "aes-128-gcm", "chacha20-poly1305", "none"];
const NETWORKS = ["tcp", "ws", "h2", "grpc"];
const CONGESTION = ["cubic", "bbr", "new_reno"];
const UDP_RELAY_MODES = ["native", "quic"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--muted)]">{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Password"}
        className="pr-9"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function TLSOptions({
  sni,
  setSni,
  skipCert,
  setSkipCert,
}: {
  sni: string;
  setSni: (v: string) => void;
  skipCert: boolean;
  setSkipCert: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[12px] border border-[var(--border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-[var(--foreground)] bg-[var(--surface-2)] hover:bg-[var(--surface)] transition-colors"
      >
        <span>TLS Options</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-[var(--muted)]" /> : <ChevronDown className="h-3.5 w-3.5 text-[var(--muted)]" />}
      </button>
      {open && (
        <div className="px-3 pt-3 pb-3 space-y-3 bg-[var(--surface)]">
          <Field label="SNI (Server Name Indication)">
            <Input value={sni} onChange={(e) => setSni(e.target.value)} placeholder="e.g. example.com" />
          </Field>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-[var(--foreground)]">Skip Certificate Verify</span>
            <Switch checked={skipCert} onCheckedChange={setSkipCert} />
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Protocol-specific fields ─────────────────────────────────────────────────
function HttpFields({
  tls,
}: {
  tls: boolean;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </Field>
      </div>
      {tls && <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />}
    </>
  );
}

function Socks5Fields({ tls }: { tls: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </Field>
      </div>
      {tls && <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />}
    </>
  );
}

function SSFields() {
  const [cipher, setCipher] = useState(SS_CIPHERS[0]);
  const [password, setPassword] = useState("");
  const [plugin, setPlugin] = useState("");
  const [pluginOpts, setPluginOpts] = useState("");
  return (
    <>
      <Field label="Cipher">
        <Select value={cipher} onValueChange={setCipher}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SS_CIPHERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} />
      </Field>
      <Field label="Plugin (optional)">
        <Select value={plugin} onValueChange={setPlugin}>
          <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            <SelectItem value="obfs">obfs</SelectItem>
            <SelectItem value="v2ray-plugin">v2ray-plugin</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {plugin && (
        <Field label="Plugin Options">
          <Input value={pluginOpts} onChange={(e) => setPluginOpts(e.target.value)} placeholder='e.g. obfs=http;obfs-host=bing.com' className="font-mono text-xs" />
        </Field>
      )}
    </>
  );
}

function VMessFields() {
  const [uuid, setUuid] = useState("");
  const [alterId, setAlterId] = useState("0");
  const [cipher, setCipher] = useState("auto");
  const [network, setNetwork] = useState("tcp");
  const [tls, setTls] = useState(false);
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  const [wsPath, setWsPath] = useState("/");
  const [wsHeaders, setWsHeaders] = useState("");
  return (
    <>
      <Field label="UUID">
        <Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alter ID">
          <Input type="number" value={alterId} onChange={(e) => setAlterId(e.target.value)} />
        </Field>
        <Field label="Cipher">
          <Select value={cipher} onValueChange={setCipher}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VMESS_CIPHERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Network">
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="TLS">
          <div className="flex items-center h-9">
            <Switch checked={tls} onCheckedChange={setTls} />
            <span className="ml-2 text-sm text-[var(--muted)]">{tls ? "Enabled" : "Disabled"}</span>
          </div>
        </Field>
      </div>
      {network === "ws" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="WS Path">
            <Input value={wsPath} onChange={(e) => setWsPath(e.target.value)} placeholder="/" className="font-mono" />
          </Field>
          <Field label="WS Headers (JSON)">
            <Input value={wsHeaders} onChange={(e) => setWsHeaders(e.target.value)} placeholder='{"Host":"example.com"}' className="font-mono text-xs" />
          </Field>
        </div>
      )}
      {tls && <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />}
    </>
  );
}

function VLESSFields() {
  const [uuid, setUuid] = useState("");
  const [flow, setFlow] = useState("");
  const [network, setNetwork] = useState("tcp");
  const [tls, setTls] = useState(false);
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <Field label="UUID">
        <Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Flow">
          <Select value={flow} onValueChange={setFlow}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Network">
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-[var(--foreground)]">TLS</span>
        <Switch checked={tls} onCheckedChange={setTls} />
      </label>
      {tls && <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />}
    </>
  );
}

function TrojanFields() {
  const [password, setPassword] = useState("");
  const [network, setNetwork] = useState("tcp");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} />
      </Field>
      <Field label="Network">
        <Select value={network} onValueChange={setNetwork}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {NETWORKS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />
    </>
  );
}

function SnellFields() {
  const [psk, setPsk] = useState("");
  const [version, setVersion] = useState("3");
  const [obfs, setObfs] = useState("simple");
  const [obfsHost, setObfsHost] = useState("");
  return (
    <>
      <Field label="PSK">
        <PasswordInput value={psk} onChange={setPsk} placeholder="Pre-shared key" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Version">
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">v1</SelectItem>
              <SelectItem value="2">v2</SelectItem>
              <SelectItem value="3">v3</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Obfs">
          <Select value={obfs} onValueChange={setObfs}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">simple</SelectItem>
              <SelectItem value="tls">tls</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      {obfs === "tls" && (
        <Field label="Obfs Host">
          <Input value={obfsHost} onChange={(e) => setObfsHost(e.target.value)} placeholder="e.g. bing.com" />
        </Field>
      )}
    </>
  );
}

function TuicFields({ v5 }: { v5?: boolean }) {
  const [uuid, setUuid] = useState("");
  const [password, setPassword] = useState("");
  const [congestion, setCongestion] = useState("bbr");
  const [udpRelay, setUdpRelay] = useState("native");
  const [alpn, setAlpn] = useState("h3");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <Field label="UUID">
        <Input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
      </Field>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Congestion Controller">
          <Select value={congestion} onValueChange={setCongestion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONGESTION.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {v5 ? (
          <Field label="ALPN">
            <Input value={alpn} onChange={(e) => setAlpn(e.target.value)} placeholder="h3" className="font-mono" />
          </Field>
        ) : (
          <Field label="UDP Relay Mode">
            <Select value={udpRelay} onValueChange={setUdpRelay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UDP_RELAY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
      <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />
    </>
  );
}

function Hysteria2Fields() {
  const [password, setPassword] = useState("");
  const [obfs, setObfs] = useState("");
  const [obfsPassword, setObfsPassword] = useState("");
  const [up, setUp] = useState("");
  const [down, setDown] = useState("");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Up Bandwidth (Mbps)">
          <Input type="number" value={up} onChange={(e) => setUp(e.target.value)} placeholder="e.g. 100" />
        </Field>
        <Field label="Down Bandwidth (Mbps)">
          <Input type="number" value={down} onChange={(e) => setDown(e.target.value)} placeholder="e.g. 200" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Obfs Type">
          <Select value={obfs} onValueChange={setObfs}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              <SelectItem value="salamander">salamander</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {obfs === "salamander" && (
          <Field label="Obfs Password">
            <PasswordInput value={obfsPassword} onChange={setObfsPassword} placeholder="Obfs password" />
          </Field>
        )}
      </div>
      <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />
    </>
  );
}

function WireGuardFields() {
  const [ip, setIp] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [presharedKey, setPresharedKey] = useState("");
  const [dns, setDns] = useState("");
  const [mtu, setMtu] = useState("1420");
  const [reserved, setReserved] = useState("");
  return (
    <>
      <Field label="Interface IP">
        <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="10.0.0.2/32" className="font-mono" />
      </Field>
      <Field label="Private Key">
        <PasswordInput value={privateKey} onChange={setPrivateKey} placeholder="Base64 private key" />
      </Field>
      <Field label="Public Key">
        <Input value={publicKey} onChange={(e) => setPublicKey(e.target.value)} placeholder="Base64 public key" className="font-mono text-xs" />
      </Field>
      <Field label="Preshared Key (optional)">
        <PasswordInput value={presharedKey} onChange={setPresharedKey} placeholder="Optional" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="DNS">
          <Input value={dns} onChange={(e) => setDns(e.target.value)} placeholder="1.1.1.1" className="font-mono" />
        </Field>
        <Field label="MTU">
          <Input type="number" value={mtu} onChange={(e) => setMtu(e.target.value)} />
        </Field>
      </div>
      <Field label="Reserved (optional)">
        <Input value={reserved} onChange={(e) => setReserved(e.target.value)} placeholder="e.g. 0,0,0" className="font-mono text-xs" />
      </Field>
    </>
  );
}

function AnyTLSFields() {
  const [password, setPassword] = useState("");
  const [sni, setSni] = useState("");
  const [skipCert, setSkipCert] = useState(false);
  return (
    <>
      <Field label="Password">
        <PasswordInput value={password} onChange={setPassword} />
      </Field>
      <TLSOptions sni={sni} setSni={setSni} skipCert={skipCert} setSkipCert={setSkipCert} />
    </>
  );
}

function SSHFields() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [useKey, setUseKey] = useState(false);
  return (
    <>
      <Field label="Username">
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="root" />
      </Field>
      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm text-[var(--foreground)]">Use Private Key</span>
        <Switch checked={useKey} onCheckedChange={setUseKey} />
      </label>
      {useKey ? (
        <Field label="Private Key (PEM)">
          <textarea
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            rows={4}
            className={cn(
              "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]",
              "px-3 py-2 text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent",
              "resize-none transition-all duration-150"
            )}
          />
        </Field>
      ) : (
        <Field label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </Field>
      )}
      <Field label="Host Key (optional)">
        <Input value={hostKey} onChange={(e) => setHostKey(e.target.value)} placeholder="e.g. ssh-rsa AAAA..." className="font-mono text-xs" />
      </Field>
    </>
  );
}

// ─── Protocol fields router ────────────────────────────────────────────────────
function ProtocolFields({ protocol }: { protocol: Protocol }) {
  switch (protocol) {
    case "HTTP":   return <HttpFields tls={false} />;
    case "HTTPS":  return <HttpFields tls={true} />;
    case "SOCKS5":     return <Socks5Fields tls={false} />;
    case "SOCKS5-TLS": return <Socks5Fields tls={true} />;
    case "SS":      return <SSFields />;
    case "VMess":   return <VMessFields />;
    case "VLESS":   return <VLESSFields />;
    case "Trojan":  return <TrojanFields />;
    case "Snell":   return <SnellFields />;
    case "TUIC":    return <TuicFields v5={false} />;
    case "TUICv5":  return <TuicFields v5={true} />;
    case "Hysteria2": return <Hysteria2Fields />;
    case "WireGuard": return <WireGuardFields />;
    case "AnyTLS": return <AnyTLSFields />;
    case "SSH":     return <SSHFields />;
    default: return null;
  }
}

// ─── Dialog ────────────────────────────────────────────────────────────────────
export function ProxyNodeDialog({ open, onClose, onSave, initialProtocol = "VMess" }: ProxyNodeDialogProps) {
  const [protocol, setProtocol] = useState<Protocol>(initialProtocol);
  const [name, setName] = useState("");
  const [server, setServer] = useState("");
  const [port, setPort] = useState("");
  const [udp, setUdp] = useState(false);
  const [tfo, setTfo] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [testing, setTesting] = useState(false);

  function handleTest() {
    setTesting(true);
    setTimeout(() => setTesting(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Proxy Node</DialogTitle>
          <DialogDescription>Configure protocol, server, and authentication details.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-5">
          {/* Protocol selector */}
          <div className="space-y-2">
            {PROTOCOL_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.protocols.map((p) => (
                    <button
                      key={p}
                      onClick={() => setProtocol(p)}
                      className={cn(
                        "rounded-[8px] px-3 py-1 text-xs font-semibold transition-all duration-150 border",
                        protocol === p
                          ? "bg-[var(--brand-500)] text-white border-[var(--brand-500)] shadow-sm"
                          : "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:border-[var(--brand-300)]"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Server + Port */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <Field label="Server">
              <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="e.g. proxy.example.com" />
            </Field>
            <Field label="Port">
              <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="443" />
            </Field>
          </div>

          {/* Protocol-specific fields */}
          <ProtocolFields protocol={protocol} />

          <div className="h-px bg-[var(--border)]" />

          {/* Common fields */}
          <Field label="Node Name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. US-01 Hysteria2" />
          </Field>

          <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)]">
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">UDP Relay</span>
                <p className="text-xs text-[var(--muted)]">Forward UDP traffic through this node</p>
              </div>
              <Switch checked={udp} onCheckedChange={setUdp} />
            </label>
            <label className="flex items-center justify-between px-3 py-2.5 cursor-pointer">
              <div>
                <span className="text-sm font-medium text-[var(--foreground)]">TCP Fast Open (TFO)</span>
                <p className="text-xs text-[var(--muted)]">Reduce latency on new connections</p>
              </div>
              <Switch checked={tfo} onCheckedChange={setTfo} />
            </label>
          </div>

          <Field label="Remarks">
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes about this node…"
              rows={2}
              className={cn(
                "w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]",
                "px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent",
                "resize-none transition-all duration-150"
              )}
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={!server || !port || testing}
            className="mr-auto gap-1.5"
          >
            <Wifi className="h-3.5 w-3.5" />
            {testing ? "Testing…" : "Test Connection"}
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSave?.({
                name: name.trim(),
                type: protocol.toLowerCase(),
                server: server.trim(),
                port: parseInt(port, 10),
                config: { udp, tfo, remarks },
              });
              onClose();
            }}
            disabled={!name.trim() || !server.trim() || !port}
          >
            Save Node
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
