export default function SettingsPage() {
  return <section className="text-stone-950">
    <p className="text-sm font-semibold text-amber-700">내 공간</p>
    <h1 className="mt-2 text-2xl font-semibold">설정</h1>
    <p className="mt-3 text-stone-600">현재 기기에서 로그아웃할 수 있어요. 프로필 공개 범위 설정은 준비 중이에요.</p>
    <form action="/api/auth/signout" method="post" className="mt-8">
      <button type="submit" className="min-h-12 rounded-xl border border-stone-300 px-5 text-sm font-semibold hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">로그아웃</button>
    </form>
  </section>;
}
