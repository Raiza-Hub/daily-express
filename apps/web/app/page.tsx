export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">
        Daily Express
      </h1>
      <p className="text-lg text-muted-foreground">
        Passenger web app, rebuilt on Tailwind CSS.
      </p>
      <a
        className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        href="#"
      >
        Explore trips
      </a>
    </main>
  );
}