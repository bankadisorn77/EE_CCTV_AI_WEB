import React from 'react';

export default function HomePage() {
  return (
    <div>
       <section
        id="home"
        className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50"
      >

        <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6">
          Real-Time Avoidance <br />
          <span className="text-indigo-600">Centralized Monitoring</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-md leading-relaxed font-light mb-8">
          Experience the future of surveillance with our AI-powered system that detects and monitors suspicious activities in real-time, ensuring enhanced security and peace of mind.
        </p>
      </section>
    </div>
  );
}
