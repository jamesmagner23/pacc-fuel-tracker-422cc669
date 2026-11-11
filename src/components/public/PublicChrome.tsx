import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BoldPMark } from "@/components/BoldPMark";

export function PublicWordmark() {
  return <div className="flex items-center gap-2.5"><BoldPMark size={30} /><div className="leading-none"><div className="text-[15px] font-semibold">PACC Energy</div><div className="text-[10px] mt-0.5 text-muted-foreground">Fuel delivery · Melbourne</div></div></div>;
}
export function PublicHeader() {
  return <header className="sticky top-0 z-50 border-b border-border bg-background"><div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4"><Link to="/landing"><PublicWordmark /></Link><div className="flex gap-2"><Button variant="outline" size="sm" asChild><Link to="/login">Sign in</Link></Button><Button size="sm" asChild><a href="/landing#contact">Get a quote</a></Button></div></div></header>;
}
export function PublicFooter() {
  return <footer className="border-t border-border bg-background"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 flex flex-wrap justify-between gap-8"><Link to="/landing"><PublicWordmark /></Link><div className="space-y-2 text-sm"><a className="block hover:underline" href="mailto:fuel@paccvictoria.com">fuel@paccvictoria.com</a><div className="flex flex-wrap gap-4"><Link className="hover:underline" to="/privacy">Privacy Policy</Link><Link className="hover:underline" to="/terms">Terms of Use</Link></div></div></div><div className="border-t border-border max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted-foreground flex flex-wrap justify-between gap-3"><span>© {new Date().getFullYear()} PACC Energy. All rights reserved.</span><span>Melbourne, Victoria</span></div></footer>;
}