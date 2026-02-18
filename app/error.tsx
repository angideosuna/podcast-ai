"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error de aplicacion:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-6xl">⚠️</div>
        <h1 className="text-3xl font-bold">Algo ha salido mal</h1>
        <p className="text-slate-400">
          Ha ocurrido un error inesperado. Puedes intentarlo de nuevo.
        </p>
        <button
          onClick={reset}
          className="cursor-pointer rounded-full bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 font-medium text-white transition-opacity hover:opacity-90"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
