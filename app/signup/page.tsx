"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { Radio } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-6 text-[#111827]">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/10">
            <span className="text-3xl">📧</span>
          </div>
          <h1 className="text-2xl font-bold">Revisa tu email</h1>
          <p className="text-[#6B7280]">
            Hemos enviado un enlace de confirmacion a{" "}
            <span className="font-medium text-[#111827]">{email}</span>
          </p>
          <p className="text-sm text-[#9CA3AF]">
            Haz clic en el enlace del email para activar tu cuenta.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="btn-huxe-outline w-full"
          >
            Ir a iniciar sesion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB]">
      {/* Left: Decorative image (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&q=80"
          alt="Estudio de podcast"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#F97316]/70 via-[#7C3AED]/50 to-[#06B6D4]/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <Radio className="h-12 w-12 text-white/90 mb-4" />
          <h2 className="text-4xl font-extrabold text-white font-[family-name:var(--font-montserrat)] tracking-tight">
            WaveCast
          </h2>
          <p className="mt-3 text-lg text-white/80 max-w-sm">
            Crea podcasts personalizados con IA. Noticias, tecnologia y mas.
          </p>
        </div>
      </div>

      {/* Right: Signup form */}
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
            Crear cuenta
          </h1>
          <p className="mt-2 text-[#6B7280] text-center lg:text-left">
            Unete a WaveCast gratis
          </p>

          <form onSubmit={handleSignup} className="mt-8 space-y-3">
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
              placeholder="Contrasena (min. 6 caracteres)"
              className="glass-input w-full"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirmar contrasena"
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
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <p className="text-center text-sm text-[#9CA3AF] mt-4">
            Ya tienes cuenta?{" "}
            <Link href="/login" className="text-[#7C3AED] underline transition-colors hover:text-[#6D28D9]">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
