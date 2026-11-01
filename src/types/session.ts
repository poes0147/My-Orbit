export interface CurrentSessionContext {
  sessionCode: string | null;
  userId: string | null;
  userSlug: string | null;
  role: "attendee" | "instructor" | "guest";
  isLoading: boolean;
}

export const EMPTY_SESSION: CurrentSessionContext = {
  sessionCode: null,
  userId: null,
  userSlug: null,
  role: "guest",
  isLoading: false,
};
