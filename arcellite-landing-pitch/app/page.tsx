import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Hero } from "@/components/sections/hero"
import { StatsBar } from "@/components/sections/stats-bar"
import { ProblemSection } from "@/components/sections/problem-section"
import { FeaturesSection } from "@/components/sections/features-section"
import { SecuritySection } from "@/components/sections/security-section"
import { IntegrationsSection } from "@/components/sections/integrations-section"
import { HowItWorksSection } from "@/components/sections/how-it-works-section"
import { AudienceSection } from "@/components/sections/audience-section"
import { PricingSection } from "@/components/sections/pricing-section"
import { CTASection } from "@/components/sections/cta-section"

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <StatsBar />
      <ProblemSection />
      <FeaturesSection />
      <SecuritySection />
      <IntegrationsSection />
      <HowItWorksSection />
      <AudienceSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
