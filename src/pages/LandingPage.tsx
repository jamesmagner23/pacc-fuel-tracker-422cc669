import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Droplets,
  Eye,
  Menu,
  Phone,
  Shield,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import truckOnsiteImg from "@/assets/truck-onsite.webp";
import truckOnsiteImg1200 from "@/assets/truck-onsite-1200.webp";
import truckOnsiteImg800 from "@/assets/truck-onsite-800.webp";
import truckRefuelImg from "@/assets/truck-refuel.webp";
import refuelImg from "@/assets/refuelling-closeup.webp";
import paccTruckSiteImg1600 from "@/assets/pacc-truck-site-1600.webp";
import paccTruckSiteImg1000 from "@/assets/pacc-truck-site-1000.webp";

// Single source of truth for the marketing phone / email.
const BUSINESS_PHONE_DISPLAY = "0409 704 327";
const BUSINESS_PHONE_TEL = "+61409704327";
const BUSINESS_EMAIL = "fuel@paccvictoria.com";

const services = [
  {
    icon: Truck,
    title: "On-site diesel delivery.",
    desc: "Direct-to-site refuelling for excavators, generators, cranes and heavy equipment across Greater Melbourne.",
  },
  {
    icon: Droplets,
    title: "Fuel storage with accountability.",
    desc: "Tanks from 500L to 10,000L with individual fob-key tracking so every litre is attributed to the right operator.",
  },
  {
    icon: Clock,
    title: "Same-day emergency response.",
    desc: "Urgent top-ups dispatched within four to six hours, twenty-four hours a day, seven days a week.",
  },
  {
    icon: Shield,
    title: "Site-ready, safety-trained drivers.",
    desc: "Inducted drivers who understand construction protocols and work around your program, not against it.",
  },
];

const trustStrip = [
  "Melbourne-wide coverage",
  "Family-run, local crews",
  "4–6 hr response",
  "24/7 emergency",
];

const testimonials = [
  {
    quote:
      "PACC fuel have been great to deal with. Very reliable and never let their clients down.",
    name: "Mark Webb",
    title: "Owner, Yarra Contracting",
  },
  {
    quote:
      "Great service. They're always there when we need them and have pulled me out of a few last-minute top-up emergencies.",
    name: "Mohamed Hamed",
    title: "Early Works Manager, Ironside",
  },
  {
    quote:
      "PACC Fuel makes things easy. Same driver every time, fits in with our sites, gets the job done without fuss.",
    name: "Mo Haider",
    title: "Construction Manager, Gearon",
  },
];

const coverage = [
  "Melbourne CBD & inner suburbs",
  "South-east Melbourne",
  "Western suburbs",
  "Northern suburbs",
  "Geelong & Bellarine",
  "Regional Victoria by arrangement",
];

function PACCWordmark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center font-semibold text-[15px]"
        style={{ background: dark ? "#C8F26A" : "#0E1F10", color: dark ? "#0E1F10" : "#FFFFFF" }}
      >
        P
      </div>
      <div className="leading-none">
        <div className={`text-[15px] font-semibold tracking-tight ${dark ? "text-[#ECE4D2]" : "text-foreground"}`}>
          PACC Energy
        </div>
        <div className={`text-[10px] mt-0.5 tracking-wide ${dark ? "text-[#A7B1A4]" : "text-muted-foreground"}`}>
          Fuel delivery · Melbourne
        </div>
      </div>
    </div>
  );
}

function QuoteForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [site, setSite] = useState("");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.from("quote_leads").insert({
        company: company.trim().slice(0, 200),
        contact_name: name.trim().slice(0, 200),
        phone: phone.trim().slice(0, 40),
        site_address: site.trim().slice(0, 400),
        delivery_date: date || null,
        source: "landing_page",
        user_agent:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 500)
            : null,
      });
      if (error) throw error;
      setSubmitted(true);
      setCompany(""); setName(""); setPhone(""); setSite(""); setDate("");
    } catch (err) {
      console.error("Quote lead submit failed", err);
      setErrorMsg(
        `Something went wrong. Please call ${BUSINESS_PHONE_DISPLAY} or email ${BUSINESS_EMAIL}.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "text-[12px] font-medium text-foreground mb-1.5 block";
  const inputCls =
    "w-full h-10 rounded-[6px] border border-border bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0";

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 bg-[#E6F3E1] text-[#2A6A2E]">
          <Check className="w-6 h-6" />
        </div>
        <h3 className="text-[18px] font-semibold mb-1">Request received.</h3>
        <p className="text-[14px] text-muted-foreground">
          We'll be in touch shortly. For same-day delivery, call{" "}
          <a href={`tel:${BUSINESS_PHONE_TEL}`} className="text-foreground font-medium underline underline-offset-2">
            {BUSINESS_PHONE_DISPLAY}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 text-[13px] text-muted-foreground underline underline-offset-2"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Company</label>
          <input className={inputCls} required maxLength={120} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Construction" />
        </div>
        <div>
          <label className={labelCls}>Your name</label>
          <input className={inputCls} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input className={inputCls} required type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" />
        </div>
        <div>
          <label className={labelCls}>Delivery date</label>
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Site address</label>
          <input className={inputCls} required maxLength={250} value={site} onChange={(e) => setSite(e.target.value)} placeholder="123 Smith St, Melbourne VIC" />
        </div>
      </div>
      {errorMsg && (
        <p role="alert" className="text-[13px] mt-4 p-3 rounded-md bg-[#FBE5E2] text-[#8C2A1F]">
          {errorMsg}
        </p>
      )}
      <Button type="submit" disabled={submitting} size="lg" className="mt-6 w-full">
        {submitting ? "Sending…" : <>Get a quote <ArrowRight className="w-4 h-4" /></>}
      </Button>
      <p className="text-[12px] mt-3 text-center text-muted-foreground">
        Or call{" "}
        <a href={`tel:${BUSINESS_PHONE_TEL}`} className="text-foreground font-medium underline underline-offset-2">
          {BUSINESS_PHONE_DISPLAY}
        </a>{" "}
        for same-day delivery.
      </p>
    </form>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* ─────────── NAV ─────────── */}
      <nav className="sticky top-0 z-50 bg-background border-b border-border" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <a href="/landing" className="shrink-0">
            <PACCWordmark />
          </a>

          <div className="hidden lg:flex items-center gap-1">
            {[
              ["Services", "#services"],
              ["Customers", "#testimonials"],
              ["Coverage", "#coverage"],
              ["About", "#about"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="px-3.5 h-9 inline-flex items-center rounded-pill text-[13px] font-medium text-foreground hover:bg-muted"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${BUSINESS_PHONE_TEL}`}
              className="hidden sm:inline-flex h-9 items-center gap-2 px-3.5 rounded-pill text-[13px] font-medium text-foreground hover:bg-muted"
              aria-label={`Call ${BUSINESS_PHONE_DISPLAY}`}
            >
              <Phone className="w-3.5 h-3.5" /> {BUSINESS_PHONE_DISPLAY}
            </a>

            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={() => navigate("/?demo=true")}>
              <Eye className="w-3.5 h-3.5" /> Demo
            </Button>

            <Button size="sm" className="hidden md:inline-flex" onClick={() => navigate("/login")}>
              Get a quote
            </Button>

            <button
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-pill border border-border text-foreground"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-background px-4 py-3 space-y-1">
            {[
              ["Services", "#services"],
              ["Customers", "#testimonials"],
              ["Coverage", "#coverage"],
              ["About", "#about"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-md text-[14px] font-medium text-foreground hover:bg-muted"
              >
                {label}
              </a>
            ))}
            <a
              href={`tel:${BUSINESS_PHONE_TEL}`}
              className="block px-3 py-2.5 rounded-md text-[14px] font-medium text-foreground hover:bg-muted"
            >
              <Phone className="w-3.5 h-3.5 inline mr-2" />
              {BUSINESS_PHONE_DISPLAY}
            </a>
            <div className="pt-2 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => { setMobileOpen(false); navigate("/?demo=true"); }}>
                Demo
              </Button>
              <Button className="flex-1" onClick={() => { setMobileOpen(false); navigate("/login"); }}>
                Get a quote
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <Badge variant="accent" className="mb-5 gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0E1F10]" /> Same-day available
            </Badge>
            <h1 className="display-xl">
              Same-day fuel delivery for Melbourne's construction and event sites.
            </h1>
            <p className="mt-5 text-[16px] leading-[1.55] text-muted-foreground max-w-[560px]">
              On-site diesel for excavators, generators, cranes and events across Greater Melbourne. The fuel partner Melbourne builders and event crews rely on.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}>
                Get a quote <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href={`tel:${BUSINESS_PHONE_TEL}`}>
                  <Phone className="w-4 h-4" /> Talk to dispatch
                </a>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
              {trustStrip.map((label) => (
                <div key={label} className="inline-flex items-center gap-2 text-[13px] text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-[12px] overflow-hidden border border-border aspect-[4/3] bg-muted">
              <img
                src={truckOnsiteImg1200}
                srcSet={`${truckOnsiteImg800} 800w, ${truckOnsiteImg1200} 1200w, ${truckOnsiteImg} 1435w`}
                sizes="(max-width: 1024px) 100vw, 40vw"
                alt="PACC Energy fuel tanker delivering diesel to a Melbourne construction site"
                width={1200}
                height={900}
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── LOGO STRIP (marquee) ─────────── */}
      <section className="bg-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="eyebrow text-center mb-6">Trusted by Melbourne businesses</div>
          <div
            className="relative overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
            }}
          >
            <div
              className="flex gap-12 whitespace-nowrap text-[15px] font-medium text-muted-foreground will-change-transform"
              style={{ animation: "pacc-marquee 28s linear infinite" }}
            >
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-12 shrink-0 pr-12" aria-hidden={dup === 1}>
                  {["Ironside", "Track Works", "Keller", "Coates", "Fulton Hogan", "Gearon"].map((name) => (
                    <span key={name + dup} className="tracking-tight">{name}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <style>{`@keyframes pacc-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
        </div>
      </section>

      {/* ─────────── SERVICES ─────────── */}
      <section id="services" className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="eyebrow mb-3">What we do</div>
          <h2 className="display-l max-w-[680px]">Full-service fuel for sites that can't stop.</h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {services.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-[12px] border border-border bg-card p-6">
                <div className="w-9 h-9 rounded-md bg-primary/10 inline-flex items-center justify-center text-primary mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-[16px] font-semibold leading-snug mb-2">{title}</h3>
                <p className="text-[14px] leading-[1.55] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── DASHBOARD FEATURE (dark) ─────────── */}
      <section className="bg-[#0E1F10] text-[#ECE4D2] border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <div className="eyebrow !text-[#A7B1A4] mb-3">Customer portal</div>
            <h2 className="display-l text-[#ECE4D2]">A live view of every litre on your sites.</h2>
            <p className="mt-4 text-[16px] leading-[1.55] text-[#A7B1A4] max-w-[480px]">
              Track deliveries, see scheduled drops, download dockets and export GST invoices — all from the customer portal, on any device.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" className="bg-[#ECE4D2] text-[#0E1F10] hover:bg-white" onClick={() => navigate("/portal")}>
                Open the portal <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="ghost" className="text-[#ECE4D2] hover:bg-white/10" onClick={() => navigate("/?demo=true")}>
                <Eye className="w-4 h-4" /> Try the demo
              </Button>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-[16px] overflow-hidden border border-[#2A4A2E] aspect-[16/10]">
              <img
                src={paccTruckSiteImg1000}
                srcSet={`${paccTruckSiteImg1000} 1000w, ${paccTruckSiteImg1600} 1600w`}
                sizes="(min-width: 1024px) 60vw, 100vw"
                alt="PACC fuel truck on a Melbourne construction site"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── TESTIMONIALS ─────────── */}
      <section id="testimonials" className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="eyebrow mb-3">Customers</div>
          <h2 className="display-l max-w-[680px]">Trusted by Melbourne businesses, every day.</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="relative rounded-[12px] border border-border bg-card p-6 overflow-hidden"
              >
                <span
                  aria-hidden
                  className="absolute top-0 left-0 h-1 w-16 rounded-br-[6px]"
                  style={{ background: "var(--accent)" }}
                />
                <div
                  aria-hidden
                  className="text-[40px] leading-none font-serif mb-1"
                  style={{ color: "var(--accent)" }}
                >
                  “
                </div>
                <blockquote className="text-[15px] leading-[1.6] text-foreground">{t.quote}</blockquote>
                <figcaption className="mt-5 pt-4 border-t border-border">
                  <div className="text-[14px] font-semibold text-foreground">{t.name}</div>
                  <div className="text-[13px] text-muted-foreground">{t.title}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── COVERAGE ─────────── */}
      <section id="coverage" className="bg-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Coverage</div>
            <h2 className="display-l">Across Greater Melbourne, around the clock.</h2>
            <p className="mt-4 text-[16px] leading-[1.55] text-muted-foreground max-w-[440px]">
              Same-day across the metro, next-day regional, and 24/7 emergency call-outs whenever a site needs us.
            </p>
          </div>
          <div className="lg:col-span-7">
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {coverage.map((label) => (
                <li key={label} className="flex items-start gap-3 text-[15px] text-foreground">
                  <Check className="w-4 h-4 mt-1 text-foreground shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─────────── ABOUT ─────────── */}
      <section id="about" className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <div className="rounded-[12px] overflow-hidden border border-border aspect-[4/3]">
              <img src={truckRefuelImg} alt="PACC Energy crew refuelling onsite" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="lg:col-span-6">
            <div className="eyebrow mb-3">About</div>
            <h2 className="display-l">A family-run crew keeping Melbourne moving.</h2>
            <p className="mt-4 text-[16px] leading-[1.55] text-muted-foreground">
              PACC Energy is a family-run Melbourne fuel business supplying diesel to the sites and events that don't get to stop. We answer the phone, we turn up, and we account for every litre.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── CONTACT / QUOTE ─────────── */}
      <section id="contact" className="bg-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <div className="eyebrow mb-3">Get a quote</div>
            <h2 className="display-l">Tell us the site, the date, and the litres.</h2>
            <p className="mt-4 text-[16px] leading-[1.55] text-muted-foreground">
              We'll come back to you the same day with pricing and a delivery window.
            </p>
            <div className="mt-6 space-y-3 text-[14px]">
              <a href={`tel:${BUSINESS_PHONE_TEL}`} className="flex items-center gap-3 text-foreground hover:underline underline-offset-2">
                <Phone className="w-4 h-4" /> {BUSINESS_PHONE_DISPLAY}
              </a>
              <a href={`mailto:${BUSINESS_EMAIL}`} className="flex items-center gap-3 text-foreground hover:underline underline-offset-2">
                <Zap className="w-4 h-4" /> {BUSINESS_EMAIL}
              </a>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-[16px] border border-border bg-card p-6 sm:p-8">
              <QuoteForm />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5">
            <PACCWordmark />
            <p className="mt-4 text-[13px] text-muted-foreground max-w-[360px]">
              On-site diesel delivery and fuel storage for Greater Melbourne, since 2005.
            </p>
          </div>
          <div className="md:col-span-3">
            <div className="eyebrow mb-3">Contact</div>
            <a href={`tel:${BUSINESS_PHONE_TEL}`} className="block text-[13px] text-foreground hover:underline underline-offset-2 mb-1.5">
              {BUSINESS_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${BUSINESS_EMAIL}`} className="block text-[13px] text-foreground hover:underline underline-offset-2">
              {BUSINESS_EMAIL}
            </a>
          </div>
          <div className="md:col-span-4">
            <div className="eyebrow mb-3">Platform</div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <a href="/login" className="text-foreground hover:underline underline-offset-2">Client login</a>
              <a href="/portal" className="text-foreground hover:underline underline-offset-2">Customer portal</a>
              <a href="/?demo=true" className="text-foreground hover:underline underline-offset-2">Try demo</a>
            </div>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <div>© {new Date().getFullYear()} PACC Energy. All rights reserved.</div>
            <div>Melbourne, Australia</div>
          </div>
        </div>
      </footer>
    </div>
  );
}