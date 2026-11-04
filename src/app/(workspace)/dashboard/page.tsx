import Link from "next/link";
import { getDashboardSummary } from "@/lib/dashboard/get-dashboard-summary";

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const hasWorkshop = Boolean(summary.workshop);
  const profile = summary.profile;
  const nextHref = profile ? `/profiles/${profile.id}/edit` : hasWorkshop ? "/builder" : "/session";
  const nextLabel = profile ? "프로필 편집" : hasWorkshop ? "프로필 작성 시작" : "워크숍 참여하기";
  const interviewStatus = summary.interviewUnavailable
    ? "확인할 수 없음"
    : summary.interview?.status === "completed" ? "완료"
      : summary.interview?.status === "in_progress" ? "작성 중"
        : "저장된 기록 없음";
  const profileStatus = summary.profileUnavailable
    ? "확인할 수 없음"
    : profile?.is_published ? "공개 중" : profile ? "발행 전" : "프로필 없음";
  const journey = [
    { title: "경험을 정리해요", detail: summary.interviewUnavailable ? "인터뷰 기록을 불러오지 못했어요." : summary.interview ? "저장된 인터뷰 기록의 상태예요." : "인터뷰 응답의 저장 기능은 아직 연결되지 않았어요.", status: interviewStatus },
    { title: "프로필을 다듬어요", detail: summary.profileUnavailable ? "프로필을 불러오지 못했어요. 잠시 후 다시 확인해 주세요." : profile ? profile.headline || "한 줄 소개를 작성해 주세요." : "프로필을 만들면 이곳에서 발행 상태를 확인할 수 있어요.", status: profileStatus },
    { title: "나의 별을 연결해요", detail: "NFC 태그 연결 데이터는 아직 준비 중이에요.", status: "준비 중" },
  ];

  return (
    <section className="grid gap-8 pb-8 text-stone-950 xl:grid-cols-2" aria-labelledby="dashboard-title">
      <header className="space-y-2 xl:col-span-2">
        <p className="text-sm font-medium text-amber-800">My Orbit · 나의 작업 공간</p>
        <h1 id="dashboard-title" className="text-3xl font-semibold tracking-tight">{summary.displayName}님의 궤도</h1>
        <p className="max-w-sm text-sm leading-6 text-stone-600">프로필을 만들고, 나의 이야기를 사람들과 나눌 준비를 해요.</p>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-stone-900 px-6 py-7 text-white" aria-labelledby="next-action-title">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 size-48 rounded-full border border-amber-200/20" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 size-32 rounded-full border border-amber-200/20" />
        <div className="relative max-w-xs">
          <p className="text-sm text-stone-300">{hasWorkshop ? "워크숍 참여 중" : "먼저 워크숍에 참여해요"}</p>
          <h2 id="next-action-title" className="mt-3 text-2xl font-semibold leading-snug">
            {profile ? "내 프로필을 다듬어볼까요?" : hasWorkshop ? "나만의 프로필 만들기를 시작해볼까요?" : "참여 코드를 입력하면 프로필 작성을 시작할 수 있어요."}
          </h2>
          {summary.workshop && (
            <p className="mt-3 text-sm leading-6 text-stone-300">
              {summary.workshop.organizationName} · {summary.workshop.title}
            </p>
          )}
          {summary.workshopUnavailable && (
            <p className="mt-3 text-sm text-amber-200">워크숍 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
          )}
          <Link
            href={nextHref}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-5 text-sm font-semibold text-stone-950 transition-colors hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
          >
            {nextLabel}
          </Link>
        </div>
      </section>

      <section aria-labelledby="snapshot-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500">현재 상태</p>
            <h2 id="snapshot-title" className="mt-1 text-lg font-semibold">프로필 요약</h2>
          </div>
          <span className="text-xs text-stone-500">연결된 정보만 표시</span>
        </div>
        <div className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          <div className="flex items-center justify-between gap-4 py-4">
            <div><p className="text-sm font-medium">외부 조회수</p><p className="mt-1 text-xs text-stone-500">공개 프로필 방문 집계</p></div>
            <span className="text-sm font-semibold text-stone-500">집계 기능 준비 중</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div><p className="text-sm font-medium">프로필 저장·공개</p><p className="mt-1 text-xs text-stone-500">{profile?.headline || profile?.slug || "프로필을 만들고 공개할 수 있어요."}</p></div>
            <span className="text-sm font-semibold text-stone-700">{profileStatus}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div><p className="text-sm font-medium">NFC 오브제</p><p className="mt-1 text-xs text-stone-500">태그와 프로필 연결 상태</p></div>
            <span className="text-sm font-semibold text-stone-500">연결 전</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-stone-500">조회수와 NFC 자료는 저장 기능이 연결된 뒤 표시돼요.</p>
      </section>

      <section aria-labelledby="journey-title">
        <div>
          <p className="text-sm text-amber-800">나의 여정</p>
          <h2 id="journey-title" className="mt-1 text-lg font-semibold">한 단계씩 완성해요</h2>
        </div>
        <ol className="mt-4 space-y-3">
          {journey.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-2xl border border-stone-200 p-4">
              <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${index === 0 ? "bg-amber-100 text-amber-900" : "bg-stone-100 text-stone-500"}`} aria-hidden="true">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <span className="text-xs text-stone-500">{step.status}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-stone-600">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="text-lg font-semibold">바로 가기</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Link href={nextHref} className="min-h-20 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">
            <span aria-hidden="true" className="block text-lg">✦</span>{profile ? "프로필 편집" : hasWorkshop ? "프로필 작성" : "참여 코드 입력"}
          </Link>
          <div className="min-h-20 rounded-2xl border border-stone-200 p-4 text-sm font-semibold text-stone-500" aria-label="NFC 태그 연결 기능 준비 중">
            <span aria-hidden="true" className="block text-lg text-stone-400">◈</span>NFC 태그 연결
            <span className="mt-1 block text-xs font-normal">기능 연결 준비 중</span>
          </div>
        </div>
      </section>
    </section>
  );
}
