import Link from "next/link";
import SessionCodeForm from "@/components/session/session-code-form";

export default function SessionPage() {
  return <section className="mx-auto w-full max-w-xl">
    <p className="text-sm font-semibold text-amber-700">나만의 이야기를 시작해요</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:mt-3 sm:text-3xl">워크숍에 참여하기</h1>
    <p className="mt-3 text-sm leading-6 text-stone-600 sm:text-base sm:leading-7">안내받은 참여 코드를 입력하면 나만의 프로필 만들기를 시작할 수 있어요.</p>
    <SessionCodeForm />
    <p className="mt-4 text-center text-xs leading-5 text-stone-500 sm:mt-5">참여 코드는 워크숍에서 안내받을 수 있어요.</p>
    <Link href="/dashboard" className="mx-auto mt-2 flex min-h-11 w-fit items-center rounded-lg px-3 py-2 text-sm font-medium text-amber-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-amber-600 sm:mt-4">내 프로필로 이동</Link>
  </section>;
}
