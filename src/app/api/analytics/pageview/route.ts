export function POST() {
  // The analytics task owns storage and aggregation. This route reserves the beacon contract.
  return new Response(null, { status: 204 });
}
