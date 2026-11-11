export const adminNavigation = [
  { href: "/admin", label: "관리자 홈", description: "운영할 작업을 선택하세요." },
  { href: "/admin/workshops", label: "워크숍 코드 관리", description: "참여 코드를 발급하고 워크숍의 참여 상태를 관리하세요." },
  { href: "/admin/clay-materials", label: "클레이 재료·배합 관리", description: "나의 별 가이드에 사용할 기본색과 조합색, 배합 레시피를 관리하세요." },
  { href: "/admin/nfc-tags", label: "NFC 태그 관리", description: "태그를 발급하고 오브제에 기록할 링크와 사용자 등록 상태를 확인하세요." },
] as const;

export function isAdminRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}
