import React from "react";
import { Play } from "lucide-react";
import Link from "next/link";

export default function EklanLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
            <span className="text-white text-xl">✤</span>
          </div>
          <span className="text-2xl font-bold text-gray-800">eklan</span>
        </div>
        <div className="flex items-center gap-4">
          <select className="border-none bg-transparent text-gray-600">
            <option>English</option>
          </select>
          <Link href="/auth/register" className="bg-green-600 text-white px-6 py-2 rounded-full hover:bg-green-700 transition">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-2 h-2 bg-green-600 rounded-full"></span>
          <span className="text-gray-600 text-sm">
            AI + Human Coach to practice &amp; share AI follow
          </span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
          Speak English with clear
          <br />
          pronunciation &amp; confidence
        </h1>

        <button className="bg-green-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-green-700 transition mb-12">
          Book a FREE Learning Call
        </button>

        <div className="flex items-center justify-center gap-12 mb-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">5.0</div>
            <div className="text-sm text-gray-600">App Rating</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">100%</div>
            <div className="text-sm text-gray-600">Happy Families</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">3 Weeks</div>
            <div className="text-sm text-gray-600">Last Cohort Size</div>
          </div>
        </div>

        <div className="text-lg text-gray-700 mb-8">Which Learner are YOU?</div>

        {/* Learner Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { img: "👩‍💼", color: "yellow", label: "Working Professional" },
            { img: "👨‍💼", color: "blue", label: "Business Leaders" },
            { img: "👩‍🎓", color: "pink", label: "Students" },
            { img: "👨‍👩‍👧", color: "purple", label: "Stay-at-home Parents" },
          ].map((learner, i) => (
            <div
              key={i}
              className="relative bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-105 transition"
            >
              <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-6xl">
                {learner.img}
              </div>
              <div
                className={`absolute bottom-4 left-4 right-4 bg-${learner.color}-400 text-white px-4 py-2 rounded-lg text-sm font-semibold`}
              >
                {learner.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real Users Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="text-green-600 text-sm mb-2">Our Alumni</div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Hear Real Users
          </h2>
          <p className="text-gray-600">
            These are real people who decided to stop being fear control their
            <br />
            views. Listen to their transformation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto mb-8">
          {["Jahnavi S.", "Sujan A.", "Naina S.", "Chandni P."].map(
            (name, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div className="relative h-64 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <button className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition">
                    <Play
                      className="w-6 h-6 text-green-600 ml-1"
                      fill="currentColor"
                    />
                  </button>
                </div>
                <div className="p-4">
                  <div className="font-bold text-gray-900">{name}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Software Engineer
                    <br />
                    Improved confidence with public speaking
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div className="text-center">
          <button className="bg-green-600 text-white px-8 py-3 rounded-full hover:bg-green-700 transition">
            Let's Help You Achieve Your Goal
          </button>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="text-green-600 text-sm mb-2">Awesome to Realize</div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            We know where it hurts
          </h2>
          <p className="text-gray-600">
            Speaking English confidently feels like it's hard. These families
            can relate. You are not alone, we got you back.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg shadow-md h-32"
                  ></div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-red-500 text-white px-6 py-2 rounded-full">
                  Recording
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 text-xl">💬</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">
                    I hesitate to speak because I'm scared of mistakes.
                  </div>
                  <div className="text-sm text-gray-600">
                    Every a pronunciation block like a tool. And grammar error
                    you make is your fundu bar partner.
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 text-xl">📚</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">
                    I know grammar but still struggle to talk naturally.
                  </div>
                  <div className="text-sm text-gray-600">
                    You're exceptional news. We don't need perfectly talk. You
                    just need structure, confidence and casual comes then
                    naturally.
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 text-xl">🎯</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">
                    I avoid speaking and my pronunciation sounds funny.
                  </div>
                  <div className="text-sm text-gray-600">
                    Why can't learn in pronunciation accent, and mispronounced
                    words. You sure practice. Follow us steps where else men's
                    guide—understand you in English.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-gray-600 mb-6">
            You deserve to be heard clearly (and confidently). Let's change this
            together.
          </div>

          <div className="text-center">
            <button className="bg-yellow-400 text-gray-900 px-8 py-3 rounded-full font-semibold hover:bg-yellow-500 transition">
              Let's Get You Ready Today
            </button>
          </div>
        </div>
      </section>

      {/* How We Fix It Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            How we fix it
          </h2>
          <p className="text-gray-600">
            Not with more vocabulary. Not with once grammatical rules. With real
            <br />
            speaking practice powered by AI, and the human touch are only
            learns.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="bg-green-50 rounded-2xl p-8 border-2 border-green-200">
            <div className="text-4xl font-bold text-green-600 mb-4">1</div>
            <div className="font-bold text-gray-900 mb-3">
              A Personal Human Coach First
            </div>
            <div className="text-sm text-gray-600">
              We start 1-on-1 with real instructors to understand your level,
              goals & psyche. AI follows. Humans lead.
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-8 border-2 border-blue-200">
            <div className="text-4xl font-bold text-blue-600 mb-4">2</div>
            <div className="font-bold text-gray-900 mb-3">
              AI-Powered, Tailored Curriculum
            </div>
            <div className="text-sm text-gray-600">
              An game loads we create personalized learning, live-fit per
              students' needs. Live & breathe. Both students & peers.
            </div>
          </div>

          <div className="bg-yellow-50 rounded-2xl p-8 border-2 border-yellow-200">
            <div className="text-4xl font-bold text-yellow-600 mb-4">3</div>
            <div className="font-bold text-gray-900 mb-3">Daily Practice</div>
            <div className="text-sm text-gray-600">
              Expand the real-world, testing role conversation. Practice daily.
              Get instant feedback about accountability, rhythm & clarity.
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 mb-16">
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-3xl p-16 text-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-sm mb-4">✦ Building courage</div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Speak English with clarity &amp; confidence.
            </h2>
            <p className="text-green-100 mb-8">
              Improve your speaking with Career Start for kids &amp; our fellow
              AI Students.
            </p>
            <button className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-full text-lg font-semibold hover:bg-yellow-500 transition">
              Get Free Trial for 7d
            </button>
            <div className="text-sm text-green-100 mt-4">
              • No Credit Card Required
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full opacity-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-400 rounded-full opacity-20 blur-3xl"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
              <span className="text-white text-xl">✤</span>
            </div>
            <span className="text-2xl font-bold text-gray-800">eklan</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button className="bg-black text-white px-6 py-2 rounded-lg flex items-center gap-2">
              <span>📱</span>
              <span className="text-sm">App Store</span>
            </button>
            <button className="bg-black text-white px-6 py-2 rounded-lg flex items-center gap-2">
              <span>▶</span>
              <span className="text-sm">Google Play</span>
            </button>
          </div>

          <div className="text-center text-sm text-gray-600 mb-4">
            Email support | +91-124-XXX-XXXX | Mail: contact @ | Contact Us
          </div>

          <div className="text-center text-xs text-gray-500">
            © 2024 eklan — All rights reserved — Terms of Service — Privacy
            Policy — All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
