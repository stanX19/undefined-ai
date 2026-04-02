"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Lottie from "lottie-react"
import { WEBAPP_LOGIN_URL } from "../lib/webapp-url"
import TestimonialsSection from "../components/testimonials-section"
import FAQSection from "../components/faq-section"
import CTASection from "../components/cta-section"
import FooterSection from "../components/footer-section"
import PricingSection from "../components/pricing-section"

// Reusable Badge Component
function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="px-[14px] py-[6px] bg-white shadow-xs overflow-hidden rounded-[90px] flex justify-start items-center gap-[8px] border border-[rgba(2,6,23,0.08)]">
      <div className="w-[14px] h-[14px] relative overflow-hidden flex items-center justify-center">{icon}</div>
      <div className="text-center flex justify-center flex-col text-[#37322F] text-xs font-medium leading-3 font-sans">
        {text}
      </div>
    </div>
  )
}

const SCROLL_THRESHOLD = 50

export default function LandingPage() {
  const [activeCard, setActiveCard] = useState(1)
  const [progress, setProgress] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [smartSimpleBrilliantLottieData, setSmartSimpleBrilliantLottieData] = useState<object | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    fetch("https://lottie.host/29e742a8-effc-4a4e-91a6-e3c0c7d901ac/ERHZpsejbC.json")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSmartSimpleBrilliantLottieData(data)
      })
      .catch((err) => console.error("Failed to load Smart Simple Brilliant Lottie", err))
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-cycling disabled - demo mockup has no animation

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD)
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleCardClick = (index: number) => {
    if (!mountedRef.current) return
    setActiveCard(index)
    setProgress(0)
  }

  const getDashboardContent = () => {
    switch (activeCard) {
      case 0:
        return <div className="text-[#828387] text-sm">Customer Subscription Status and Details</div>
      case 1:
        return <div className="text-[#828387] text-sm">Analytics Dashboard - Real-time Insights</div>
      case 2:
        return <div className="text-[#828387] text-sm">Data Visualization - Charts and Metrics</div>
      default:
        return <div className="text-[#828387] text-sm">Customer Subscription Status and Details</div>
    }
  }

  return (
    <div className="w-full min-h-screen relative bg-[#F7F5F3] overflow-x-hidden flex flex-col justify-start items-center">
      <div className="relative flex flex-col justify-start items-center w-full">
        {/* Main container with proper margins */}
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-0 lg:max-w-[1060px] lg:w-[1060px] relative flex flex-col justify-start items-start min-h-screen">
          {/* Left vertical line */}
          <div className="w-px h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-[rgba(55,50,47,0.12)] shadow-[1px_0px_0px_white] z-0"></div>

          {/* Right vertical line */}
          <div className="w-px h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-[rgba(55,50,47,0.12)] shadow-[1px_0px_0px_white] z-0"></div>

          <div className="self-stretch pt-[9px] overflow-hidden border-b border-[rgba(55,50,47,0.06)] flex flex-col justify-center items-center gap-4 sm:gap-6 md:gap-8 lg:gap-[48px] relative z-10">
            {/* Navigation - floating and wider on scroll */}
            <div
              className={`w-full h-12 sm:h-14 md:h-16 lg:h-[84px] flex justify-center items-center z-40 px-4 sm:px-6 md:px-8 lg:px-12 transition-all duration-300 ease-out ${
                isScrolled ? "fixed left-0 right-0 top-4 md:top-5" : "absolute left-0 top-0"
              }`}
            >
              {!isScrolled && (
                <div className="w-full h-0 absolute left-0 top-6 sm:top-7 md:top-8 lg:top-[42px] border-t border-[rgba(55,50,47,0.12)] shadow-[0px_1px_0px_white] pointer-events-none"></div>
              )}

              <div
                className={`h-10 sm:h-11 md:h-12 py-1.5 sm:py-2 px-3 sm:px-4 md:px-5 pr-2 sm:pr-3 overflow-hidden rounded-full flex justify-between items-center relative transition-all duration-300 ease-out ${
                  isScrolled
                    ? "w-full max-w-[960px] bg-[#37322F]/95 backdrop-blur-md shadow-[0_4px_24px_rgba(55,50,47,0.3)]"
                    : "w-full max-w-[calc(100%-32px)] sm:max-w-[calc(100%-48px)] md:max-w-[calc(100%-64px)] lg:max-w-[700px] lg:w-[700px] bg-white backdrop-blur-sm border border-[#E0DEDB]"
                }`}
              >
                <div className="flex justify-center items-center">
                  <div className="flex justify-start items-center">
                    <div
                      className={`flex flex-col justify-center text-sm sm:text-base md:text-lg lg:text-xl font-medium leading-5 font-sans transition-colors duration-300 ease-out ${
                        isScrolled ? "text-white" : "text-[#2F3037]"
                      }`}
                    >
                      Undefined AI
                    </div>
                  </div>
                  <div className="pl-3 sm:pl-4 md:pl-5 lg:pl-5 hidden sm:flex justify-start items-start flex-row gap-2 sm:gap-3 md:gap-4 lg:gap-4">
                    <a
                      href="https://github.com/MarcusMQF/undefined-ai"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col justify-center text-xs md:text-[13px] font-medium leading-[14px] font-sans transition-colors duration-300 ease-out no-underline cursor-pointer ${
                        isScrolled ? "text-gray-300 hover:text-white" : "text-[rgba(49,45,43,0.80)] hover:text-[#2F3037]"
                      }`}
                    >
                      GitHub
                    </a>
                    <a
                      href="https://github.com/MarcusMQF/undefined-ai/tree/main/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col justify-center text-xs md:text-[13px] font-medium leading-[14px] font-sans transition-colors duration-300 ease-out no-underline cursor-pointer ${
                        isScrolled ? "text-gray-300 hover:text-white" : "text-[rgba(49,45,43,0.80)] hover:text-[#2F3037]"
                      }`}
                    >
                      Docs
                    </a>
                  </div>
                </div>
                <div className="h-6 sm:h-7 md:h-8 flex justify-start items-start gap-2 sm:gap-3">
                  <a
                    href={WEBAPP_LOGIN_URL}
                    className={`px-2 sm:px-3 md:px-[14px] py-1 sm:py-[6px] overflow-hidden rounded-full flex justify-center items-center transition-all duration-300 ease-out no-underline ${
                      isScrolled
                        ? "bg-white/95 text-black hover:bg-white shadow-[0px_1px_2px_rgba(255,255,255,0.2)]"
                        : "bg-[#37322F] shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] hover:bg-[#2A2520] text-white"
                    }`}
                  >
                    <span className="text-xs md:text-[13px] font-medium leading-5 font-sans">
                      Log in
                    </span>
                  </a>
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="pt-8 sm:pt-10 md:pt-14 lg:pt-[120px] pb-8 sm:pb-12 md:pb-16 flex flex-col justify-start items-center px-2 sm:px-4 md:px-8 lg:px-0 w-full sm:pl-0 sm:pr-0 pl-0 pr-0">
              <div className="w-full max-w-[937px] lg:w-[937px] flex flex-col justify-center items-center gap-3 sm:gap-4 md:gap-5 lg:gap-6">
                <div className="self-stretch rounded-[3px] flex flex-col justify-center items-center gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                  <img src="/logo.png" alt="Undefined AI" className="h-14 w-auto sm:h-16 md:h-20 object-contain" />
                  <div className="w-full max-w-[748.71px] lg:w-[748.71px] text-center flex justify-center flex-col text-[#37322F] text-[24px] xs:text-[28px] sm:text-[36px] md:text-[52px] lg:text-[80px] font-normal leading-[1.1] sm:leading-[1.15] md:leading-[1.2] lg:leading-24 font-serif px-2 sm:px-4 md:px-0 text-balance">
                    Learning that adapts to you in real time
                  </div>
                  <div className="w-full max-w-[506.08px] lg:w-[506.08px] text-center flex justify-center flex-col text-[rgba(55,50,47,0.80)] sm:text-lg md:text-xl leading-[1.4] sm:leading-[1.45] md:leading-normal lg:leading-7 font-sans px-2 sm:px-4 md:px-0 lg:text-lg font-medium text-sm text-pretty">
                    A new kind of learning platform where AI doesn't just answer questions, it builds the entire interface around your knowledge.
                  </div>
                </div>
              </div>

              <div className="w-full max-w-[497px] lg:w-[497px] flex flex-col justify-center items-center gap-6 sm:gap-8 md:gap-10 lg:gap-12 relative z-10 mt-5 sm:mt-7 md:mt-9 lg:mt-11">
                <div className="backdrop-blur-[8.25px] flex justify-start items-center gap-4">
                  <a
                    href={WEBAPP_LOGIN_URL}
                    className="h-10 sm:h-11 md:h-12 px-6 sm:px-8 md:px-10 lg:px-12 py-2 sm:py-[6px] relative bg-[#37322F] shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] overflow-hidden rounded-full flex justify-center items-center hover:bg-[#2A2520] transition-colors"
                  >
                    <div className="w-20 sm:w-24 md:w-28 lg:w-44 h-[41px] absolute left-0 top-[-0.5px] bg-linear-to-b from-[rgba(255,255,255,0)] to-[rgba(0,0,0,0.10)] mix-blend-multiply"></div>
                    <div className="flex flex-col justify-center text-white text-sm sm:text-base md:text-[15px] font-medium leading-5 font-sans">
                      Start for free
                    </div>
                  </a>
                </div>
              </div>

              <div className="absolute top-[220px] sm:top-[240px] md:top-[260px] lg:top-[360px] left-1/2 transform -translate-x-1/2 z-0 pointer-events-none">
                <img
                  src="/mask-group-pattern.svg"
                  alt=""
                  className="w-[936px] sm:w-[1404px] md:w-[2106px] lg:w-[2808px] h-auto opacity-30 sm:opacity-40 md:opacity-50 mix-blend-multiply"
                  style={{
                    filter: "hue-rotate(15deg) saturate(0.7) brightness(1.2)",
                  }}
                />
              </div>

              <div className="w-full max-w-[960px] lg:w-[960px] pt-2 sm:pt-4 pb-6 sm:pb-8 md:pb-10 px-2 sm:px-4 md:px-6 lg:px-11 flex flex-col justify-center items-center gap-2 relative z-5 my-5 sm:my-7 md:my-9 lg:my-11 mb-0 lg:pb-0">
                <div className="w-full max-w-[960px] lg:w-[960px] h-[200px] sm:h-[280px] md:h-[450px] lg:h-[695.55px] bg-white shadow-[0px_0px_0px_0.9056603908538818px_rgba(0,0,0,0.08)] overflow-hidden rounded-[6px] sm:rounded-[8px] lg:rounded-[9.06px] flex flex-col justify-start items-start">
                  {/* Dashboard Content */}
                  <div className="self-stretch flex-1 flex justify-start items-start">
                    {/* Main Content */}
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="relative w-full h-full overflow-hidden">
                        {/* Product Image 1 - Plan your schedules */}
                        <div
                          className={`absolute inset-0 ${
                            activeCard === 0 ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                          }`}
                        >
                          <img
                            src="/demo.png"
                            alt="Undefined AI - Learning interface"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Product Image 2 - Data to insights */}
                        <div
                          className={`absolute inset-0 ${
                            activeCard === 1 ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                          }`}
                        >
                          <img
                            src="/demo.png"
                            alt="Undefined AI - Learning interface"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Product Image 3 - Data visualization */}
                        <div
                          className={`absolute inset-0 ${
                            activeCard === 2 ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                          }`}
                        >
                          <img
                            src="/demo.png"
                            alt="Undefined AI - Learning interface"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="self-stretch border-t border-b border-[#E0DEDB] flex justify-center items-start">
                <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                  {/* Left decorative pattern */}
                  <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className="self-stretch h-3 sm:h-4 -rotate-45 origin-top-left border-[0.5px] border-[rgba(3,7,18,0.08)]"
                      ></div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 px-0 sm:px-2 md:px-0 flex flex-col md:flex-row justify-center items-stretch gap-0">
                  {/* Feature Cards */}
                  <FeatureCard
                    title="Dynamic Learning Interfaces"
                    description="Upload PDFs, URLs, or voice input and the AI automatically generates the best learning format, including mind maps, timelines, quizzes, or structured content."
                    isActive={activeCard === 0}
                    progress={activeCard === 0 ? progress : 0}
                    onClick={() => handleCardClick(0)}
                  />
                  <FeatureCard
                    title="AI-Powered Knowledge Compression"
                    description="Documents are transformed into structured knowledge trees through multi-stage compression, turning complex information into clear, traceable learning units."
                    isActive={activeCard === 1}
                    progress={activeCard === 1 ? progress : 0}
                    onClick={() => handleCardClick(1)}
                  />
                  <FeatureCard
                    title="Real-Time Interactive Learning"
                    description="Every interaction updates the interface instantly through live AI generation, allowing users to explore topics with adaptive recommendations and interactive components."
                    isActive={activeCard === 2}
                    progress={activeCard === 2 ? progress : 0}
                    onClick={() => handleCardClick(2)}
                  />
                </div>

                <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                  {/* Right decorative pattern */}
                  <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className="self-stretch h-3 sm:h-4 -rotate-45 origin-top-left border-[0.5px] border-[rgba(3,7,18,0.08)]"
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bento Grid Section */}
              <div id="features" className="w-full border-b border-[rgba(55,50,47,0.12)] flex flex-col justify-center items-center">
                {/* Header Section */}
                <div className="self-stretch px-4 sm:px-6 md:px-8 lg:px-0 lg:max-w-[1060px] lg:w-[1060px] py-8 sm:py-12 md:py-16 border-b border-[rgba(55,50,47,0.12)] flex justify-center items-center gap-6">
                  <div className="w-full max-w-[616px] lg:w-[616px] px-4 sm:px-6 py-4 sm:py-5 overflow-hidden rounded-lg flex flex-col justify-start items-center gap-3 sm:gap-4">
                    <Badge
                      icon={
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="1" y="1" width="4" height="4" stroke="#37322F" strokeWidth="1" fill="none" />
                          <rect x="7" y="1" width="4" height="4" stroke="#37322F" strokeWidth="1" fill="none" />
                          <rect x="1" y="7" width="4" height="4" stroke="#37322F" strokeWidth="1" fill="none" />
                          <rect x="7" y="7" width="4" height="4" stroke="#37322F" strokeWidth="1" fill="none" />
                        </svg>
                      }
                      text="Built for You"
                    />
                    <div className="w-full max-w-[598.06px] lg:w-[598.06px] text-center flex justify-center flex-col text-[#49423D] text-xl sm:text-2xl md:text-3xl lg:text-5xl font-semibold leading-tight md:leading-[60px] font-sans tracking-tight">
                      Built for absolute clarity and focused learning
                    </div>
                    <div className="self-stretch text-center text-[#605A57] text-sm sm:text-base font-normal leading-6 sm:leading-7 font-sans">
                      AI that shapes the interface around you,
                      <br />
                      so you stay focused on what matters
                    </div>
                  </div>
                </div>

                {/* Bento Grid Content */}
                <div className="self-stretch flex justify-center items-start">
                  <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                    {/* Left decorative pattern */}
                    <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                      {Array.from({ length: 200 }).map((_, i) => (
                        <div
                          key={i}
                          className="self-stretch h-3 sm:h-4 -rotate-45 origin-top-left border-[0.5px] border-[rgba(3,7,18,0.08)]"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[0.4fr_0.6fr] gap-0 border-l border-r border-[rgba(55,50,47,0.12)] min-h-[400px] md:min-h-[500px]">
                    {/* Left - Hero cell: Smart. Simple. Brilliant. (Lottie) */}
                    <div className="order-2 md:order-1 border-b md:border-b-0 md:border-r border-[rgba(55,50,47,0.12)] p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col justify-start items-start gap-4 sm:gap-6">
                      <div className="flex flex-col gap-2 w-full">
                        <h3 className="text-[#37322F] text-lg sm:text-xl font-semibold leading-tight font-sans">
                          Smart. Simple. Brilliant.
                        </h3>
                        <p className="text-[#605A57] text-sm md:text-base font-normal leading-relaxed font-sans">
                          Your content becomes structured learning—mind maps, timelines, and quizzes, generated from PDFs, URLs, or your voice, without extra manual work.
                        </p>
                      </div>
                      <div className="w-full flex-1 min-h-[200px] sm:min-h-[250px] md:min-h-0 rounded-lg flex items-center justify-center overflow-hidden relative">
                        {smartSimpleBrilliantLottieData && (
                          <div className="absolute inset-0 flex items-center justify-center w-full h-full">
                            <Lottie
                              animationData={smartSimpleBrilliantLottieData}
                              loop
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              className="min-w-0 min-h-0"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right - Text cells stacked */}
                    <div className="order-1 md:order-2 flex flex-col">
                      {/* Learning that adapts to you */}
                      <div className="flex-1 border-b border-[rgba(55,50,47,0.12)] p-6 sm:p-8 md:p-8 lg:p-10 flex flex-col justify-center gap-3 bg-[#FAF9F8]/50">
                        <h3 className="text-[#37322F] text-lg sm:text-xl font-semibold leading-tight font-sans">
                          Learning that adapts to you
                        </h3>
                        <p className="text-[#605A57] text-sm md:text-base font-normal leading-relaxed font-sans">
                          Every interaction updates your interface. The AI adjusts formats and recommendations as you learn, keeping your path clear and focused.
                        </p>
                      </div>

                      {/* From chaos to clarity */}
                      <div className="flex-1 border-b border-[rgba(55,50,47,0.12)] p-6 sm:p-8 md:p-8 lg:p-10 flex flex-col justify-center gap-3 bg-[#FAF9F8]/30">
                        <h3 className="text-[#37322F] text-lg sm:text-xl font-semibold leading-tight font-sans">
                          From chaos to clarity
                        </h3>
                        <p className="text-[#605A57] text-sm md:text-base font-normal leading-relaxed font-sans">
                          AI turns your content into organized, traceable knowledge trees instead of scattered notes.
                        </p>
                      </div>

                      {/* Knowledge you can trust */}
                      <div className="flex-1 p-6 sm:p-8 md:p-8 lg:p-10 flex flex-col justify-center gap-3">
                        <h3 className="text-[#37322F] text-lg sm:text-xl font-semibold leading-tight font-sans">
                          Knowledge you can trust
                        </h3>
                        <p className="text-[#605A57] text-sm md:text-base font-normal leading-relaxed font-sans">
                          Multi-stage AI compression turns complex material into clear units. Trace every idea back to its source so you learn confidently.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-4 sm:w-6 md:w-8 lg:w-12 self-stretch relative overflow-hidden">
                    {/* Right decorative pattern */}
                    <div className="w-[120px] sm:w-[140px] md:w-[162px] left-[-40px] sm:left-[-50px] md:left-[-58px] top-[-120px] absolute flex flex-col justify-start items-start">
                      {Array.from({ length: 200 }).map((_, i) => (
                        <div
                          key={i}
                          className="self-stretch h-3 sm:h-4 -rotate-45 origin-top-left border-[0.5px] border-[rgba(3,7,18,0.08)]"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <PricingSection />

              {/* Testimonials Section */}
              <TestimonialsSection />

              {/* FAQ Section */}
              <FAQSection />

              {/* CTA Section */}
              <CTASection />

              {/* Footer Section */}
              <FooterSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// FeatureCard component definition inline to fix import error
function FeatureCard({
  title,
  description,
  isActive,
  progress,
  onClick,
}: {
  title: string
  description: string
  isActive: boolean
  progress: number
  onClick: () => void
}) {
  return (
    <div
      className={`w-full md:flex-1 self-stretch px-6 py-5 overflow-hidden flex flex-col justify-start items-start gap-2 cursor-pointer relative border-b md:border-b-0 last:border-b-0 transition-colors duration-200 ${
        isActive
          ? "bg-white shadow-[0px_0px_0px_0.75px_#E0DEDB_inset]"
          : "border-l-0 border-r-0 md:border border-[#E0DEDB]/80"
      } ${!isActive ? "hover:bg-white" : ""}`}
      onClick={onClick}
    >
      {isActive && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-[rgba(50,45,43,0.08)]">
          <div
            className="h-full bg-[#322D2B] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="self-stretch flex justify-center flex-col text-sm md:text-sm font-semibold leading-6 md:leading-6 font-sans text-[#49423D]">
        {title}
      </div>
      <div className="self-stretch text-[13px] md:text-[13px] font-normal leading-[22px] md:leading-[22px] font-sans text-[#605A57]">
        {description}
      </div>
    </div>
  )
}
