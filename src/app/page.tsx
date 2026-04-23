import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white font-sans selection:bg-[#6c63ff] selection:text-white relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#6c63ff] rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#a29bfe] rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

      <main className="z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto space-y-8">

        {/* Main Heading */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6c63ff] to-[#a29bfe]">EngineerOS</span>
        </h1>

        {/* Updated Subtitle */}
        <p className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed max-w-2xl mx-auto mb-8">
          The ultimate AI-powered study platform for Indian engineering students. Learn smarter, not harder.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8 w-full">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 bg-[#1a1a24] hover:bg-[#252533] text-white rounded-xl font-medium transition-all duration-300 border border-gray-800 shadow-lg"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#6c63ff] to-[#5a52d5] hover:opacity-90 text-white rounded-xl font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(108,99,255,0.4)]"
          >
            Get Started Free
          </Link>
        </div>

      </main>
    </div>
  );
}