import Link from "next/link";

export default function SessionPage() {
  return <section className="flex min-h-[70dvh] flex-col justify-center">
    <p className="text-sm font-semibold text-amber-700">나만의 이야기를 시작해요</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">워크숍에 참여하기</h1>
    <p className="mt-3 leading-7 text-stone-600">안내받은 참여 코드를 입력하면 나만의 프로필 만들기를 시작할 수 있어요.</p>
    <form className="mt-8 space-y-4">
      <label htmlFor="session-code" className="block text-sm font-medium text-stone-800">참여 코드</label>
      <input id="session-code" name="sessionCode" inputMode="text" autoComplete="off" maxLength={6} placeholder="예: A1B2C3" className="h-14 w-full rounded-2xl border border-stone-300 px-4 text-lg uppercase tracking-[0.25em] outline-none transition placeholder:tracking-normal focus:border-amber-500 focus:ring-4 focus:ring-amber-100"/>
      <button type="button" className="h-14 w-full rounded-2xl bg-stone-900 font-semibold text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600">참여 코드 확인</button>
    </form>
    <p className="mt-5 text-center text-xs leading-5 text-stone-500">참여 코드는 워크숍에서 안내받을 수 있어요.</p>
    <Link href="/dashboard" className="mx-auto mt-4 rounded-lg px-3 py-2 text-sm font-medium text-amber-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-amber-600">내 프로필로 이동</Link>
  </section>;
}
