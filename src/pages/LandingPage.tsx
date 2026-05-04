import { useNavigate } from "react-router-dom";
import { Clock, Shield, Truck, MapPin, ChevronRight, Star, Droplets, Zap, Users, Mail, Eye, BarChart3, FileText, Layers, Smartphone } from "lucide-react";
import { BoldPMark } from "@/components/BoldPMark";
import heroImg from "@/assets/hero-construction.jpg";
import refuelImg from "@/assets/refuelling-closeup.jpg";
import truckSideImg from "@/assets/truck-side.jpg";
import truckOnsiteImg from "@/assets/truck-onsite.jpg";
import truckDeliveryImg from "@/assets/truck-delivery.jpg";
import truckRefuelImg from "@/assets/truck-refuel.jpg";
import truckSiteImg from "@/assets/truck-site.jpg";

function PACCNavLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <BoldPMark size={30} bg="#1A472A" fg="#C8F26A" rounded={7} />
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontFamily: "'Archivo Narrow','Archivo','Inter',sans-serif", fontSize: 18, fontWeight: 800, color: "#ECE4D2", letterSpacing: "0.02em", textTransform: "uppercase" as const, lineHeight: 1 }}>
          PACC ENERGY
        </div>
        <div style={{ fontSize: 8, fontWeight: 600, color: "#8B8773", letterSpacing: "0.22em", marginTop: 4, textTransform: "uppercase" as const }}>
          Powered by Progress
        </div>
      </div>
    </div>
  );
}

const testimonials = [
  {
    quote: "PACC fuel have been great to deal with. Very reliable and never let their clients down. Can't recommend highly enough.",
    name: "Mark Webb",
    title: "Owner",
    company: "Yarra Contracting",
  },
  {
    quote: "Great service by the PACC Fuel guys, they're always there when we need them and have pulled me out of a few last minute top up emergencies.",
    name: "Mohamed Hamed",
    title: "Early Works Manager",
    company: "IRONSIDE",
  },
  {
    quote: "PACC Fuel just makes things easy for us. The same driver shows up every time, fits in with our sites, and gets the job done without any fuss.",
    name: "Mo Haider",
    title: "Construction Manager",
    company: "Gearon",
  },
  {
    quote: "James and the team at PACC Fuel have been great and easy to deal with. Their scheduling and reliability for fuel deliveries has been on point.",
    name: "Andy Papas",
    title: "Owner",
    company: "High Rise Productions",
  },
];

const services = [
  { icon: Truck, title: "On-Site Diesel Delivery", desc: "Direct-to-site refuelling for excavators, generators, cranes and all heavy equipment across Greater Melbourne." },
  { icon: Droplets, title: "Fuel Storage Solutions", desc: "Professional tanks from 500L to 10,000L+ with individual fob key tracking for complete fuel accountability." },
  { icon: Clock, title: "Same-Day Delivery", desc: "Urgent fuel needs? We offer same-day delivery for emergency top-ups — typically within 4–6 hours." },
  { icon: Shield, title: "Site-Ready Drivers", desc: "Safety-trained, experienced drivers who understand construction site protocols and work around your schedule." },
];

const industries = [
  "Construction & Civil Works",
  "Events & Entertainment",
  "Tower Crane Operations",
  "Generators & Temporary Power",
  "Mining & Quarries",
  "Transport & Logistics",
];

const coverage = [
  "Melbourne CBD & Inner Suburbs",
  "South East Melbourne",
  "Western Suburbs",
  "Northern Suburbs",
  "Geelong & Bellarine Peninsula",
  "Regional Victoria (by arrangement)",
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "#0E1F10", color: "#ECE4D2", minHeight: "100vh" }}>
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50" style={{ background: "rgba(14,31,16,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(42,74,46,0.6)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          <PACCNavLogo />
          <div className="hidden md:flex items-center gap-6">
            <a href="#services" className="text-xs font-medium tracking-wide uppercase" style={{ color: "#C7BFAC" }}>Services</a>
            <a href="#testimonials" className="text-xs font-medium tracking-wide uppercase" style={{ color: "#C7BFAC" }}>Testimonials</a>
            <a href="#coverage" className="text-xs font-medium tracking-wide uppercase" style={{ color: "#C7BFAC" }}>Coverage</a>
            <a href="#contact" className="text-xs font-medium tracking-wide uppercase" style={{ color: "#C7BFAC" }}>Contact</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate("/?demo=true")}
              className="px-3 sm:px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
              style={{ background: "rgba(245,230,208,0.08)", color: "#ECE4D2", border: "1px solid rgba(42,74,46,0.7)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245,230,208,0.14)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245,230,208,0.08)"; }}
            >
              <Eye className="w-3 h-3" /> Try Demo
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-3 sm:px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all"
              style={{ background: "#C8F26A", color: "#0E1F10", border: "none" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#B6E254"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#C8F26A"; }}
            >
              Client Login
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ minHeight: "min(85vh, 700px)" }}>
        <div className="absolute inset-0">
          <img src={truckOnsiteImg} alt="PACC Energy fuel tanker delivering diesel to a Melbourne construction site" width={1920} height={1080} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(14,31,16,0.55) 0%, rgba(14,31,16,0.35) 40%, rgba(14,31,16,0.85) 100%)" }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 flex flex-col justify-center" style={{ minHeight: "min(85vh, 700px)" }}>
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold" style={{ background: "rgba(200,242,106,0.15)", border: "1px solid rgba(200,242,106,0.3)", color: "#C8F26A" }}>
                <Zap className="w-3 h-3" /> Same-day delivery available
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight" style={{ color: "#ECE4D2" }}>
              Melbourne's Fast-Response{" "}
              <span style={{ color: "#C8F26A" }}>Fuel Delivery</span>{" "}
              for Construction & Events
            </h1>
            <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-xl" style={{ color: "#C7BFAC" }}>
              Same-day diesel delivery to your site. Servicing excavators, generators, cranes, and events across Greater Melbourne. Trusted by 50+ construction sites with 20+ years experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all"
                style={{ background: "#C8F26A", color: "#0E1F10", boxShadow: "0 8px 32px rgba(200,242,106,0.3)" }}
              >
                Request a Quote <ChevronRight className="w-4 h-4" />
              </a>
              <a
                href="mailto:fuel@paccvictoria.com"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all"
                style={{ background: "rgba(245,230,208,0.08)", color: "#ECE4D2", border: "1px solid rgba(42,74,46,0.7)" }}
              >
                <Mail className="w-4 h-4" /> fuel@paccvictoria.com
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ background: "#142A16", borderTop: "1px solid #2A4A2E", borderBottom: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: "50+", label: "Construction Sites" },
            { val: "20+", label: "Years Experience" },
            { val: "4–6hr", label: "Delivery Window" },
            { val: "24/7", label: "Emergency Service" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-bold" style={{ color: "#C8F26A" }}>{s.val}</div>
              <div className="text-[11px] font-medium uppercase tracking-wider mt-1" style={{ color: "#8B8773" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>What We Do</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
            Full-Service Fuel Solutions
          </h2>
          <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#8B8773" }}>
            The trusted choice for Melbourne's construction and events industry
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((s) => (
            <div
              key={s.title}
              className="p-5 rounded-xl transition-all"
              style={{ background: "#142A16", border: "1px solid #2A4A2E" }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(200,242,106,0.12)" }}>
                <s.icon className="w-5 h-5" style={{ color: "#C8F26A" }} />
              </div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "#ECE4D2" }}>{s.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#8B8773" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT SPLIT ── */}
      <section style={{ background: "#142A16", borderTop: "1px solid #2A4A2E", borderBottom: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>On-Site When You Need Us</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4" style={{ color: "#ECE4D2" }}>
              Keeping Melbourne's Sites Running
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#C7BFAC" }}>
              Our professional drivers bring fuel directly to your construction site, keeping your equipment running and your project on schedule. No downtime, no hassle.
            </p>
            <ul className="space-y-3">
              {["Experienced, site-ready drivers", "Flexible delivery times", "Minimal disruption to your work", "Competitive, transparent pricing"].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm" style={{ color: "#ECE4D2" }}>
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.12)" }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#C8F26A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #2A4A2E" }}>
            <img src={truckSideImg} alt="PACC Energy fuel tanker on construction site" width={1280} height={854} loading="lazy" className="w-full h-auto object-cover" />
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>Trusted By</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
            Industries We Serve
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {industries.map((ind) => (
            <div key={ind} className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={{ background: "#142A16", border: "1px solid #2A4A2E" }}>
              <Users className="w-4 h-4 flex-shrink-0" style={{ color: "#C8F26A" }} />
              <span className="text-xs font-medium" style={{ color: "#ECE4D2" }}>{ind}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CLIENT PORTAL ── */}
      <section style={{ background: "#142A16", borderTop: "1px solid #2A4A2E", borderBottom: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>
              More Than Just Fuel
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
              Your Free Live Fuel Dashboard
            </h2>
            <p className="mt-3 text-sm max-w-xl mx-auto" style={{ color: "#C7BFAC" }}>
              Every PACC Energy customer gets free 24/7 access to a private online portal — see every drop the moment
              it lands, broken down by site, project, and machine. No spreadsheets, no waiting for end-of-month invoices.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { icon: BarChart3, title: "Live Deliveries", desc: "Watch every drop appear in real time with litres, driver, and price." },
              { icon: Layers, title: "Project & Plant View", desc: "Fuel costs broken down per site and per machine — bill back accurately." },
              { icon: FileText, title: "Instant Dockets", desc: "Download branded PDF dockets and CSV exports for your accounts team." },
              { icon: Smartphone, title: "Works on Mobile", desc: "Site supervisors can check fuel status from the ute on 4G." },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-xl" style={{ background: "#1B3520", border: "1px solid #2A4A2E" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: "rgba(200,242,106,0.12)" }}>
                  <f.icon className="w-5 h-5" style={{ color: "#C8F26A" }} />
                </div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: "#ECE4D2" }}>{f.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#8B8773" }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate("/?demo=true")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold cursor-pointer transition-all"
              style={{ background: "#C8F26A", color: "#0E1F10", boxShadow: "0 8px 32px rgba(200,242,106,0.3)" }}
            >
              <Eye className="w-4 h-4" /> See a Live Demo
            </button>
          </div>
        </div>
      </section>

      {/* ── PHOTO GALLERY ── */}
      <section style={{ background: "#142A16", borderTop: "1px solid #2A4A2E", borderBottom: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>In Action</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
              Our Fleet at Work
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { src: truckSideImg, alt: "PACC fuel tanker side view at construction site" },
              { src: truckOnsiteImg, alt: "PACC driver refuelling excavator on site" },
              { src: truckDeliveryImg, alt: "Fuel delivery in progress" },
              { src: truckRefuelImg, alt: "Bowser refuelling on construction site" },
            ].map((img) => (
              <div key={img.alt} className="rounded-xl overflow-hidden aspect-[4/3]" style={{ border: "1px solid #2A4A2E" }}>
                <img src={img.src} alt={img.alt} loading="lazy" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" style={{ background: "#142A16", borderTop: "1px solid #2A4A2E", borderBottom: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>Testimonials</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
              What Our Clients Say
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {testimonials.map((t) => (
              <div key={t.name} className="p-5 rounded-xl" style={{ background: "#1B3520", border: "1px solid #2A4A2E" }}>
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-3.5 h-3.5 fill-current" style={{ color: "#C8F26A" }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4 italic" style={{ color: "#C7BFAC" }}>
                  "{t.quote}"
                </p>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "#ECE4D2" }}>{t.name}</div>
                  <div className="text-[11px]" style={{ color: "#8B8773" }}>
                    {t.title}, {t.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COVERAGE ── */}
      <section id="coverage" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>Service Area</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ECE4D2" }}>
            Fast Delivery Across Melbourne
          </h2>
          <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "#8B8773" }}>
            Typically 4–6 hours for scheduled deliveries, same-day for urgent requests
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {coverage.map((area) => (
            <div key={area} className="flex items-center gap-2.5 px-4 py-3.5 rounded-xl" style={{ background: "#142A16", border: "1px solid #2A4A2E" }}>
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#C8F26A" }} />
              <span className="text-xs font-medium" style={{ color: "#ECE4D2" }}>{area}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA / CONTACT ── */}
      <section id="contact" style={{ background: "#142A16", borderTop: "1px solid #2A4A2E" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8F26A" }}>Get Started</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4" style={{ color: "#ECE4D2" }}>
            Ready to Simplify Your Fuel Supply?
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "#8B8773" }}>
            Get a competitive quote for your site. No hidden fees, no lock-in contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:fuel@paccvictoria.com"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all"
              style={{ background: "#C8F26A", color: "#0E1F10", boxShadow: "0 8px 32px rgba(200,242,106,0.3)" }}
            >
              <Mail className="w-4 h-4" /> fuel@paccvictoria.com
            </a>
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium cursor-pointer transition-all"
              style={{ background: "rgba(245,230,208,0.08)", color: "#ECE4D2", border: "1px solid rgba(42,74,46,0.7)" }}
            >
              Client Portal Login <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0E1F10", borderTop: "1px solid #2A4A2E" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <PACCNavLogo />
            <p className="text-[11px] tracking-wider uppercase" style={{ color: "#8B8773" }}>
              PACC Energy Pty Ltd · Melbourne, Victoria
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
