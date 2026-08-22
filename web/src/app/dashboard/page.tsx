import { Brand } from '@/components/Brand'

export default function DashboardPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl items-center px-5 py-16 sm:px-8">
      <section className="w-full rounded-2xl border border-border-default bg-content p-8 shadow-[0_28px_70px_-36px_var(--hrack-shadow-popover)] sm:p-10">
        <p className="font-maple text-[10px] tracking-[0.2em] text-text-faint uppercase">
          remote · authenticated
        </p>
        <p className="mt-4">
          <Brand className="text-[40px]" />
        </p>
        <h1 className="mt-6 text-[24px] font-semibold tracking-tight text-text-primary">
          Remote console connected
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
          Your account session is live. Pairing URL management lands in the
          dashboard CRUD slice.
        </p>
      </section>
    </main>
  )
}
