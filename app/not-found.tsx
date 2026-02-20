import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-dark">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="text-6xl">🔍</div>
        <h1 className="text-3xl font-bold text-forest">Pagina no encontrada</h1>
        <p className="text-muted">
          La pagina que buscas no existe o ha sido movida.
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-forest px-6 py-3 font-medium text-white transition-all duration-300 hover:bg-forest-light"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
