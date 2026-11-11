import NfcTagManager from "@/components/admin/nfc-tag-manager";

export default function NfcTagsPage() {
  return <div className="min-w-0"><h1 className="text-3xl font-semibold tracking-tight">NFC 태그 관리</h1><p className="mt-3 text-sm leading-7 text-admin-muted">오브제에 기록할 태그를 발급하고 등록 상태를 확인하세요.</p><NfcTagManager /></div>;
}
