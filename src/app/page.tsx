import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 sm:p-20 gap-16 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center sm:items-start">
        <h1 className="text-3xl font-bold">Welcome to Inquiry Manager</h1>
        <p className="text-lg text-center sm:text-left">
          Manage your customer inquiries efficiently.
        </p>
        <div className="flex gap-4">
          <Link
            href="/signup"
            className="rounded-full bg-blue-500 text-white px-6 py-2 text-sm sm:text-base hover:bg-blue-600 transition"
          >
            Sign Up
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-blue-500 text-blue-500 px-6 py-2 text-sm sm:text-base hover:bg-blue-500 hover:text-white transition"
          >
            Log In
          </Link>
        </div>
      </main>
    </div>
  );
}
