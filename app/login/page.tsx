"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { Radio } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al iniciar sesion"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      {/* Left: Decorative image (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1200&q=80"
          alt="Microfono de podcast"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED]/80 via-[#A855F7]/60 to-[#06B6D4]/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <Radio className="h-12 w-12 text-white/90 mb-4" />
          <h2 className="text-4xl font-extrabold text-white font-[family-name:var(--font-montserrat)] tracking-tight">
            WaveCast
          </h2>
          <p className="mt-3 text-lg text-white/80 max-w-sm">
            Tu podcast diario personalizado con inteligencia artificial
          </p>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-[#111827]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2">
              <Radio className="h-6 w-6 text-[#7C3AED]" />
              <span className="text-2xl font-extrabold font-[family-name:var(--font-montserrat)]">WaveCast</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center lg:text-left">
            Iniciar sesion
          </h1>
          <p className="mt-2 text-[#6B7280] text-center lg:text-left">
            Bienvenido de vuelta
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              className="glass-input w-full"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Contrasena"
              className="glass-input w-full"
            />

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-huxe w-full mt-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Iniciando sesion..." : "Iniciar sesion"}
            </button>
          </form>

          <Link href="/signup" className="btn-huxe-outline w-full block text-center mt-3">
            Crear cuenta
          </Link>

          <p className="text-center text-[12px] text-[#9CA3AF] mt-4">
            Al iniciar sesion aceptas nuestros{" "}
            <span className="underline">Terminos</span> y{" "}
            <span className="underline">Politica de Privacidad</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
          <div className="text-[#9CA3AF]">Cargando...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
