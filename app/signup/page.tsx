"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="text-6xl">📧</div>
          <h1 className="text-2xl font-bold text-forest">Revisa tu email</h1>
          <p className="text-muted">
            Hemos enviado un enlace de confirmación a{" "}
            <span className="font-medium text-dark">{email}</span>
          </p>
          <p className="text-sm text-muted-light">
            Haz clic en el enlace del email para activar tu cuenta.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="cursor-pointer rounded-full border border-white/[0.08] bg-cream-light/80 px-6 py-3 font-medium text-dark/80 transition-all duration-300 hover:border-forest/20 hover:text-forest"
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-white">WaveCast</span>
          </h1>
          <p className="mt-2 text-muted">Crea tu cuenta gratuita</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-4 glass-card p-6">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-dark/80"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="glass-input w-full"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-dark/80"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 6 caracteres"
                className="glass-input w-full"
              />
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-dark/80"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repite la contraseña"
                className="glass-input w-full"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-light">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="text-forest underline transition-colors duration-300 hover:text-forest-light"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
