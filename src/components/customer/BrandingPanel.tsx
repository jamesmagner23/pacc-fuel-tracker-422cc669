import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Wand2, Loader2, RotateCcw, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { isValidHex, ensureContrast, contrastRatio, bestForeground } from "@/lib/brandTheme";

interface Account {
  id: number;
  company_name: string;
  logo_url: string | null;
  brand_accent: string | null;
  branding_enabled: boolean | null;
}

/**
 * Admin-only branding controls for a single client account. Lets admins
 * upload a logo, auto-extract the brand color via AI, override it manually,
 * and toggle branding on/off. The portal reads these fields and applies
 * them at render time (see CustomerPortal).
 */
export function BrandingPanel({ account, onChange }: { account: Account; onChange?: () => void }) {
  const qc = useQueryClient();
  const [hex, setHex] = useState<string>(account.brand_accent || "#3F6B36");
  const [enabled, setEnabled] = useState<boolean>(!!account.branding_enabled);
  const [logoUrl, setLogoUrl] = useState<string | null>(account.logo_url);
  const [busy, setBusy] = useState<"idle" | "uploading" | "extracting" | "saving">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  // Light + dark surfaces the accent will sit on. We check both so the brand
  // color reads in either portal theme.
  const surfaceLight = "#FFFFFF";
  const surfaceDark = "#142A16";
  const safeOnLight = isValidHex(hex) ? ensureContrast(hex, surfaceLight, 4.5) : hex;
  const safeOnDark = isValidHex(hex) ? ensureContrast(hex, surfaceDark, 4.5) : hex;
  const fgLight = bestForeground(safeOnLight);
  const fgDark = bestForeground(safeOnDark);
  const ratioLight = isValidHex(hex) ? contrastRatio(hex, surfaceLight) : 0;
  const ratioDark = isValidHex(hex) ? contrastRatio(hex, surfaceDark) : 0;

  async function handleUpload(file: File) {
    setBusy("uploading");
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${account.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("client-logos").getPublicUrl(path);
      const url = pub.publicUrl;
      setLogoUrl(url);
      // Persist immediately so the URL survives even if user navigates away.
      await supabase.from("client_accounts").update({ logo_url: url }).eq("id", account.id);
      toast({ title: "Logo uploaded" });
      // Auto-extract a color suggestion right after upload.
      await extractColor(url);
      onChange?.();
      qc.invalidateQueries({ queryKey: ["client-account-by-name"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy("idle");
    }
  }

  async function extractColor(url?: string) {
    const target = url || logoUrl;
    if (!target) {
      toast({ title: "Upload a logo first", variant: "destructive" });
      return;
    }
    setBusy("extracting");
    try {
      const { data, error } = await supabase.functions.invoke("extract-brand-color", {
        body: { imageUrl: target },
      });
      if (error) throw error;
      if (data?.hex) {
        setHex(data.hex);
        toast({ title: "Detected brand color", description: data.hex });
      } else if (data?.error) {
        toast({ title: "Could not detect color", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Detection failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy("idle");
    }
  }

  async function save() {
    if (!isValidHex(hex)) {
      toast({ title: "Invalid hex color", variant: "destructive" });
      return;
    }
    setBusy("saving");
    try {
      const { error } = await supabase
        .from("client_accounts")
        .update({
          brand_accent: hex.toUpperCase(),
          branding_enabled: enabled,
        })
        .eq("id", account.id);
      if (error) throw error;
      toast({ title: "Branding saved" });
      onChange?.();
      qc.invalidateQueries({ queryKey: ["client-account-by-name"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy("idle");
    }
  }

  async function clearLogo() {
    if (!confirm("Remove this logo and disable branding?")) return;
    await supabase
      .from("client_accounts")
      .update({ logo_url: null, branding_enabled: false })
      .eq("id", account.id);
    setLogoUrl(null);
    setEnabled(false);
    onChange?.();
    qc.invalidateQueries({ queryKey: ["client-account-by-name"] });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider">Customer Branding</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logo + accent color shown in this customer's portal. Structural colors stay locked for readability.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          {enabled ? "Branding ON" : "Branding OFF"}
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
        {/* Logo */}
        <div className="space-y-2">
          <div
            className="aspect-square rounded-md border border-border flex items-center justify-center overflow-hidden"
            style={{ background: "#FFFFFF" }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="max-w-[80%] max-h-[80%] object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== "idle"}
            >
              {busy === "uploading" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
              Upload
            </Button>
            {logoUrl && (
              <Button size="sm" variant="ghost" onClick={clearLogo} disabled={busy !== "idle"}>
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Color controls */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Brand accent</label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={isValidHex(hex) ? hex : "#3F6B36"}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="w-12 h-10 rounded border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="#RRGGBB"
                className="font-mono w-32"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => extractColor()}
                disabled={!logoUrl || busy !== "idle"}
                title="Auto-detect from logo with AI"
              >
                {busy === "extracting" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}
                Auto-detect
              </Button>
            </div>
          </div>

          {/* Contrast preview */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <PreviewSwatch
              label="On light surface"
              raw={hex}
              safe={safeOnLight}
              fg={fgLight}
              ratio={ratioLight}
              surface={surfaceLight}
            />
            <PreviewSwatch
              label="On dark surface"
              raw={hex}
              safe={safeOnDark}
              fg={fgDark}
              ratio={ratioDark}
              surface={surfaceDark}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={busy !== "idle"}>
              {busy === "saving" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Save branding
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setHex(account.brand_accent || "#3F6B36");
                setEnabled(!!account.branding_enabled);
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSwatch({
  label,
  raw,
  safe,
  fg,
  ratio,
  surface,
}: {
  label: string;
  raw: string;
  safe: string;
  fg: string;
  ratio: number;
  surface: string;
}) {
  const adjusted = raw.toUpperCase() !== safe.toUpperCase();
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div style={{ background: surface, padding: 10 }}>
        <button
          type="button"
          style={{
            background: safe,
            color: fg,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            width: "100%",
          }}
        >
          Sample button
        </button>
        <div className="mt-1 text-[10px] flex justify-between" style={{ color: surface === "#FFFFFF" ? "#555" : "#bbb" }}>
          <span>{ratio.toFixed(1)}:1</span>
          {adjusted && <span title={`Auto-adjusted from ${raw}`}>↻ adjusted</span>}
        </div>
      </div>
    </div>
  );
}