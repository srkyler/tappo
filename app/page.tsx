import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { About } from "@/components/landing/about";
import { Services } from "@/components/landing/services";
import { Pricing } from "@/components/landing/pricing";
import { Contact } from "@/components/landing/contact";
import { Footer } from "@/components/footer";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="bg-black text-white">
        <Hero />
        <Features />
        <About />
        <Services />
        <Pricing />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
