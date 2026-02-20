"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
    <div className="w-full max-w-md space-y-8">
      {/* Logo */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif">
          <span className="text-forest">PodCast</span>
          <span className="text-muted-light">.ai</span>
        </h1>
        <p className="mt-2 text-muted">Inicia sesion en tu cuenta</p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleLogin} className="space-y-6">
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
              Contrasena
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Tu contrasena"
              className="glass-input w-full"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full cursor-pointer rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Iniciando sesion..." : "Iniciar sesion"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-light">
        ¿No tienes cuenta?{" "}
        <Link
          href="/signup"
          className="text-forest underline transition-colors duration-300 hover:text-forest-light"
        >
          Registrate
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
      <Suspense
        fallback={
          <div className="text-muted">Cargando...</div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
