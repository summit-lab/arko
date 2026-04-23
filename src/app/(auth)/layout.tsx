export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Celeste sky wash — extiende el cielo de la imagen por toda la pagina */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(207, 227, 242, 0.45) 0%, rgba(184, 214, 234, 0.35) 55%, rgba(165, 200, 227, 0.25) 100%)",
        }}
      />
      <div className="absolute inset-0 hidden dark:block bg-gradient-to-b from-slate-900/40 via-slate-900/30 to-slate-800/20" />

      {/* Imagen de montanas al 100% del ancho, altura automatica (aspect ratio natural).
          Se muestra completa, anclada al fondo. El maskImage disuelve el tope en el cielo. */}
      <img
        src="/logos/moka%20montanas.jpg.jpeg"
        alt=""
        aria-hidden
        className="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none"
        style={{
          opacity: 0.2,
          filter: "blur(1px)",
          maskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Vinneta sutil para legibilidad del panel */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-background/5 to-background/20 dark:via-black/10 dark:to-black/40" />

      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
