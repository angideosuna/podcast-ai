import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-cream text-dark">
      {/* Hero */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 text-center">
        {/* Glow effect */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-forest/10 blur-[150px]" />

        <h1 className="relative text-5xl font-extrabold tracking-tight sm:text-7xl">
          <span className="text-white">WaveCast</span>
        </h1>
        <p className="relative mt-4 max-w-xl text-lg text-muted sm:text-xl">
          Tu podcast diario generado con IA. Noticias, tendencias y temas que te
          importan, en audio personalizado cada mañana.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-forest px-8 py-3.5 text-lg font-semibold text-cream transition-all duration-300 hover:bg-forest-light hover:shadow-lg hover:shadow-forest/20"
          >
            Empezar gratis
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/[0.08] px-8 py-3.5 text-lg font-semibold text-dark transition-all duration-300 hover:border-forest/30 hover:text-forest"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
          Cómo funciona
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Elige tus temas",
              desc: "Selecciona las categorías y subtemas que te interesan: tecnología, economía, deportes y más.",
              emoji: "🎯",
            },
            {
              step: "2",
              title: "La IA genera tu podcast",
              desc: "Nuestro motor analiza las noticias del día y crea un guión personalizado con tu estilo.",
              emoji: "✨",
            },
            {
              step: "3",
              title: "Escucha donde quieras",
              desc: "Reproduce tu podcast con voces naturales, ajusta la velocidad y comparte con amigos.",
              emoji: "🎧",
            },
          ].map((item) => (
            <div key={item.step} className="glass-card p-6 text-center">
              <div className="mb-4 text-4xl">{item.emoji}</div>
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest/10 text-sm font-bold text-forest">
                {item.step}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Caracteristicas */}
      <section className="mx-auto max-w-5xl px-4 py-24">
        <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">
          Características
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            {
              title: "Noticias en tiempo real",
              desc: "Contenido basado en artículos del día, siempre actualizado.",
              emoji: "📰",
            },
            {
              title: "Duración personalizable",
              desc: "Desde 5 hasta 60 minutos. Tú eliges cuánto tiempo dedicar.",
              emoji: "⏱️",
            },
            {
              title: "Voces naturales",
              desc: "Escucha con voces masculinas o femeninas en español.",
              emoji: "🗣️",
            },
            {
              title: "Programación automática",
              desc: "Configura tu horario y recibe tu podcast listo cada día.",
              emoji: "📅",
            },
          ].map((feat) => (
            <div key={feat.title} className="glass-card flex gap-4 p-6">
              <span className="text-3xl">{feat.emoji}</span>
              <div>
                <h3 className="text-lg font-semibold">{feat.title}</h3>
                <p className="mt-1 text-sm text-muted">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Final */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Crea tu podcast con IA
        </h2>
        <p className="mt-4 text-muted">
          Únete y empieza a escuchar contenido hecho a tu medida, todos los días.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-full bg-forest px-8 py-3.5 text-lg font-semibold text-cream transition-all duration-300 hover:bg-forest-light hover:shadow-lg hover:shadow-forest/20"
        >
          Crear mi podcast con IA
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-muted">
        <span className="font-bold text-[#1DB954]">
          WaveCast
        </span>{" "}
        — Podcasts personalizados con inteligencia artificial
      </footer>
    </div>
  );
}
