export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute inset-0 bg-[url('/backgrownd.PNG')] bg-cover bg-center bg-no-repeat opacity-10 dark:opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background dark:from-black/60 dark:via-black/80 dark:to-black" />
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
