import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#f6f2e9] px-5 py-10 text-stone-950">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-[-9rem] size-[26rem] rounded-full border border-amber-900/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-[-7rem] size-[22rem] rounded-full border border-amber-900/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 bottom-[-12rem] size-[34rem] rounded-full border border-amber-900/10" />

      <section className="relative w-full max-w-md rounded-[2rem] border border-stone-200/80 bg-white/90 p-7 shadow-[0_24px_80px_-48px_rgba(41,37,36,0.35)] backdrop-blur sm:p-10" aria-labelledby="login-title">
        <Link href="/login" className="inline-flex items-center gap-2 rounded-lg text-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-stone-900 text-lg text-amber-300">✦</span>
          My Orbit
        </Link>

        <div className="mt-10">
          <p className="text-sm font-semibold text-amber-800">나만의 이야기를 연결해요</p>
          <h1 id="login-title" className="mt-2 text-3xl font-semibold tracking-tight">로그인하고 시작하기</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">간편 로그인 후 워크숍 참여 코드를 입력하고, 나를 소개하는 프로필을 만들어보세요.</p>
        </div>

        <div className="mt-8 space-y-3">
          <button type="button" disabled aria-describedby="login-setup-note" className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-400 opacity-80">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-stone-200 text-base font-bold">G</span>
            Google로 계속하기
          </button>
          <button type="button" disabled aria-describedby="login-setup-note" className="flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl bg-[#FEE500] px-4 text-sm font-semibold text-stone-500 opacity-65">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-stone-900/10 text-xs font-bold">k</span>
            카카오로 계속하기
          </button>
        </div>

        <p id="login-setup-note" className="mt-4 rounded-xl bg-stone-50 px-4 py-3 text-xs leading-5 text-stone-500">
          소셜 로그인 연결을 준비하고 있어요. 연결이 완료되면 여기서 바로 로그인할 수 있습니다.
        </p>

        <div className="mt-8 border-t border-stone-100 pt-5">
          <p className="text-center text-xs leading-5 text-stone-500">로그인하면 계정 정보는 프로필과 워크숍 참여를 관리하는 데 사용됩니다.</p>
        </div>
      </section>
    </main>
  );
}
