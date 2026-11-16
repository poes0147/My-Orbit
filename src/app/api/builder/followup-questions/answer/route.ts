import { NextRequest } from 'next/server';
import { handleFollowup } from '@/lib/builder/followup-handler';
export const maxDuration=30;
export async function POST(request:NextRequest){return handleFollowup(request,'answer');}
